import jsonpath from 'jsonpath';
import fs from 'fs';
import md5 from 'md5';
import cache from '../cache.js';
import config from '../config.js';
import logger from '../logger.js';
import path from 'path';

import {sortJsonArrayByIdAndKeys} from './utils.js';

// ---- helpers ----
const uniq = arr => Array.from(new Set((arr || []).filter((v) => v != null)));

function uniqById(nodes = []) {
  const seen = new Set();
  const out = [];
  for (const n of nodes) {
    const id = n && n['@id'];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(n);
  }
  return out;
}

function pushUniqueById(resultArr, node) {
  const id = node && node['@id'];
  if (!id) { resultArr.push(node); return; }
  const i = resultArr.findIndex(x => x && x['@id'] === id);
  if (i === -1) resultArr.push(node);
  else resultArr[i] = node; // replace with latest version
}

function joinNonEmpty(parts, sep = ', ') {
  return (parts || []).filter(v => v != null && String(v).trim() !== '').join(sep);
}

function buildOdrDisplayName(lastName, firstName, listing) {
  const left = `${lastName}, ${firstName}`;
  const right = joinNonEmpty([listing?.title, listing?.deptName], ', ');
  return joinNonEmpty([left, right], ' § ');
}

// Approximate SPARQL’s ODR “public/usable” gates by WWW flags
function hasUsableOdr(listing) {
  if (!listing) return false;
  const hasTitle = listing.title && listing.titleWwwFlag !== 'N';
  const hasWeb   = listing.website && listing.websiteWwwFlag === 'Y';
  // Dept alone no longer triggers an ODR vcard; must have title or website.
  return Boolean(hasTitle || hasWeb);
}

// Mirror SPARQL-ish PPS visibility logic from directory listings flags.
function derivePpsVisibility(listings = []) {
  // Defaults match SPARQL behavior: if we *don’t* see a hiding rule, treat as visible.
  let emailVisible = true;
  let deptVisible  = true;
  let titleVisible = true;

  for (const l of listings) {
    // email: if any listing says "N" *and* does not provide an email value, hide PPS email
    if (l?.emailWwwFlag === 'N') {
      // SPARQL checks a NOT EXISTS on value; approximate by lack of l.email
      if (!l.email) emailVisible = false;
    }

    // dept: if any listing says "N" and lacks both code & name, hide PPS dept
    if (l?.deptWwwFlag === 'N') {
      const hasDeptValues = !!(l?.deptName && l?.deptCode);
      if (!hasDeptValues) deptVisible = false;
    }

    // title: if any listing says "N" and lacks a title value, hide PPS title
    if (l?.titleWwwFlag === 'N') {
      if (!l?.title) titleVisible = false;
    }
  }

  return { emailVisible, deptVisible, titleVisible };
}

function run(expertId, profile, cdl, ucopVocab) {
  const result = [];
  const expertUri = `http://experts.ucdavis.edu/expert/${expertId}`;

  // --- Basic profile pulls
  const iamId        = jsonpath.value(profile, '$["@graph"][0].iamId');
  const iamUserId    = jsonpath.value(profile, '$["@graph"][0].userId') ||
                       jsonpath.value(profile, '$["@graph"][0].userID') ||
                       jsonpath.value(profile, '$["@graph"][0].iamUserId');
  const email        = jsonpath.value(profile, '$["@graph"][0].email');
  const firstName    = jsonpath.value(profile, '$["@graph"][0].dFirstName');
  const middleName   = jsonpath.value(profile, '$["@graph"][0].dMiddleName');
  const lastName     = jsonpath.value(profile, '$["@graph"][0].dLastName');
  // Normalize ALL-CAPS first/middle/last (>=2 chars) to Capitalized (e.g. WILLIAM -> William)
  const normalizeAllCaps = s => (typeof s === 'string' && /^[A-Z]{2,}$/.test(s)) ? (s.charAt(0) + s.slice(1).toLowerCase()) : s;
  const formattedFirstName = normalizeAllCaps(firstName);
  const formattedMiddleName = normalizeAllCaps(middleName);
  const formattedLastName = normalizeAllCaps(lastName);
  const isFaculty    = jsonpath.value(profile, '$["@graph"][0].isFaculty') || false;
  const isHSEmployee = jsonpath.value(profile, '$["@graph"][0].isHSEmployee') || false;
  const pronouns     = jsonpath.value(profile, '$["@graph"][0].directory.displayName.preferredPronouns');

  const ppsAssociations   = jsonpath.value(profile, '$["@graph"][0].ppsAssociations') || [];
  // SPARQL construct requires a matching iam:ppsAssociations blank node providing assocRank, titleOfficialName, titleCode, deptCode, deptOfficialName.
  // Mirror by gating: if none present with all required fields, emit empty result.
  const viablePpsAssociations = (Array.isArray(ppsAssociations) ? ppsAssociations : [ppsAssociations]).filter(a => a &&
    a.assocRank != null &&
    a.titleOfficialName &&
    a.titleCode &&
    a.deptCode &&
    (a.deptDisplayName || a.deptOfficialName)
  );
  if (!viablePpsAssociations.length) {
    return []; // Gate: no PPS association satisfying required pattern
  }

  const directoryListings = jsonpath.value(profile, '$["@graph"][0].directory.listings') || [];

  // ODR visibility gate (SPARQL sets ?odr_is_visible via nameWwwFlag=N ⇒ false)
  const odrNameWwwFlag = jsonpath.value(profile, '$["@graph"][0].directory.displayName.nameWwwFlag');
  const odrIsVisible   = odrNameWwwFlag === 'N' ? false : true;

  // --- SPARQL bind.rq template join gating ---
  // Need: IAM userID present; CDL user graph with category "user" & is-public "true" & is-login-allowed "true"; nameWwwFlag === 'Y'
  const cdlUserGraphs = (cdl['@graph'] || []).filter(g => {
    const obj = g && g['api:object'];
    if (!obj) return false;
    const cat = obj['api:category'] || obj['category'];
    return cat === 'user' && obj['api:is-public'] === 'true' && obj['api:is-login-allowed'] === 'true';
  });
  const cdlUserGraph = cdlUserGraphs[0];
  const cdlUsername = cdlUserGraph && cdlUserGraph['api:object'] && (cdlUserGraph['api:object']['api:username'] || cdlUserGraph['api:object']['username']);
  const joinedUserId = cdlUsername && /@ucdavis\.edu$/i.test(cdlUsername)
    ? cdlUsername.replace(/@ucdavis\.edu$/i,'')
    : null;

  // If gating fails, emit no output (match SPARQL which would not construct anything for this profile)
  if (!iamUserId || !joinedUserId || iamUserId !== joinedUserId || odrNameWwwFlag !== 'Y') {
    return []; // hard gate
  }

  // CDL user object fields sourced from gated user graph only
  const cdlObj = (cdlUserGraph && cdlUserGraph['api:object']) || {};
  const cdlUserFirstName = cdlObj['api:first-name'] || cdlObj['first-name'];
  const cdlUserLastName  = cdlObj['api:last-name']  || cdlObj['last-name'];
  const cdlDepartment    = cdlObj['api:department'] || cdlObj['department'];
  const cdlPosition      = cdlObj['api:position']   || cdlObj['position'];
  // The oapolicy/user identifier association ark (keep existing logic using id if present)
  const cdlUserId        = cdlObj.id; // retained for legacy identifier list

  // Overview / research-interests / teaching-summary only from this gated user graph
  // (native fields under records/record/native/field with privacy public already pre-filtered upstream)
  const nativeFields = jsonpath.query(cdlUserGraph, '$["api:object"]["api:records"]["api:record"]["api:native"]["api:field"]') || [];
  const flattenNative = Array.isArray(nativeFields) ? nativeFields.flatMap(f => Array.isArray(f) ? f : [f]) : [];
  function extractFieldText(name) {
    const node = flattenNative.find(f => f && f.name === name);
    const textNode = node && node['api:text'];
    return textNode && textNode['$t'];
  }
  const cdlOverview          = extractFieldText('overview');
  const cdlResearchInterests = extractFieldText('research-interests');
  const cdlTeachingSummary   = extractFieldText('teaching-summary');

  // Extract websites ONLY from gated user graph
  const websiteFields = flattenNative.filter(f => f && f.name === 'personal-websites');
  const cdlWebsites = websiteFields.flatMap(field => (field['api:web-addresses']?.['api:web-address']) ? field['api:web-addresses']['api:web-address'] : []);

  // Identifier associations inside gated user graph
  const assocNodes = jsonpath.query(cdlUserGraph, '$["api:object"]["api:user-identifier-associations"]["api:user-identifier-association"]') || [];
  const assocArray = Array.isArray(assocNodes) ? assocNodes.flatMap(a => Array.isArray(a) ? a : [a]) : [];
  function findAssoc(scheme) {
    const node = assocArray.find(a => a && a.scheme === scheme);
    return node && node['$t'];
  }
  const orcidId      = findAssoc('orcid');
  const scopusIds    = assocArray.filter(a => a && a.scheme === 'scopus-author-id').map(a => a['$t']).filter(Boolean);
  const researcherId = findAssoc('researcherid');

  // --- Name variations (canonical ordering incl full middle name)
  const rawLast = (lastName || '').toLowerCase();
  const cleanLast = rawLast.replace(/[^a-z]/g,'');
  const cleanFirst = (firstName || '').toLowerCase().replace(/[^a-z]/g,'');
  const cleanMiddle = (middleName || '').toLowerCase().replace(/[^a-z]/g,'');
  const nameVariants = [
    `${cleanLast}_${cleanFirst.charAt(0)}`,
    ...(cleanMiddle ? [`${cleanLast}_${cleanFirst.charAt(0)}${cleanMiddle.charAt(0)}`] : []),
    `${cleanLast}_${cleanFirst}`,
    ...(cleanMiddle ? [`${cleanLast}_${cleanFirst}${cleanMiddle.charAt(0)}`] : []),
    ...(cleanMiddle ? [`${cleanLast}_${cleanFirst}${cleanMiddle}`] : [])
  ];
  const nameMatches = uniq(nameVariants.filter(v => v));

  // --- Expert node
  const expertType = (isFaculty ? "http://vivoweb.org/ontology/core#FacultyMember" : "http://vivoweb.org/ontology/core#NonAcademic");

  const expert = {
    "@id": expertUri,
    "@type": [
      "http://schema.library.ucdavis.edu/schema#Expert",
      "http://schema.org/Person",
      expertType
    ],
    "http://www.w3.org/2000/01/rdf-schema#label": [{ "@value": `${formattedLastName}, ${formattedFirstName}` }],
    "http://schema.library.ucdavis.edu/schema#is-visible": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(odrIsVisible) }
    ],
    "http://schema.library.ucdavis.edu/schema#isHSEmployee": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(isHSEmployee) }
    ],
    "http://schema.library.ucdavis.edu/schema#name_match": nameMatches.map(v => ({ "@value": v })),
    "http://www.w3.org/2006/vcard/ns#hasName": [{ "@id": `ark:/87287/d7c08j/user/${iamId}#name` }]
  };

  if (orcidId)  expert["http://vivoweb.org/ontology/core#orcidId"]     = [{ "@value": orcidId }];
  if (scopusIds && scopusIds.length) expert["http://vivoweb.org/ontology/core#scopusId"] = scopusIds.map(v => ({ "@value": v }));
  if (researcherId) expert["http://vivoweb.org/ontology/core#researcherId"] = [{ "@value": researcherId }];
  if (cdlOverview) expert["http://vivoweb.org/ontology/core#overview"] = [{ "@value": cdlOverview }];
  if (cdlResearchInterests) expert["http://schema.library.ucdavis.edu/schema#researchInterests"] = [{ "@value": cdlResearchInterests }];
  if (cdlTeachingSummary)  expert["http://schema.library.ucdavis.edu/schema#teachingSummary"]   = [{ "@value": cdlTeachingSummary }];

  // --- schema:identifier (gate mailto like SPARQL using ppsEmailVisible)
  const { emailVisible: ppsEmailVisible } = derivePpsVisibility(directoryListings);
  const identifiers = [
    { "@id": expertUri },
    { "@id": `ark:/87287/d7c08j/user/${iamId}` },
    ...(cdlUserId ? [{ "@id": `ark:/87287/d7mh2m/user/${cdlUserId}` }] : []),
    ...(ppsEmailVisible && !isHSEmployee && email ? [{ "@id": `mailto:${email}` }] : []),
    ...(orcidId ? [{ "@id": `http://orcid.org/${orcidId}` }] : []),
    ...(scopusIds && scopusIds.length ? scopusIds.map(id => ({ "@id": `https://www.scopus.com/authid/detail.uri?authorId=${id}` })) : []),
    ...(researcherId ? [{ "@id": `https://www.webofscience.com/wos/author/record/${researcherId}` }] : [])
  ];
  expert["http://schema.org/identifier"] = uniqById(identifiers);

  // --- Name record
  const nameRecord = {
    "@id": `ark:/87287/d7c08j/user/${iamId}#name`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Name"],
    "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": formattedLastName }],
    "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": formattedFirstName }]
  };
  if (formattedMiddleName) {
    nameRecord["http://www.w3.org/2006/vcard/ns#middleName"] = [{ "@value": formattedMiddleName }];
  }
  if (pronouns)   nameRecord["http://www.w3.org/2006/vcard/ns#pronouns"]   = [{ "@value": pronouns }];
  pushUniqueById(result, nameRecord);

  // --- ODR listings: keep only usable/public ones
  const odrListings = (directoryListings || []).filter(hasUsableOdr);
  const hasOdr = odrListings.length > 0;
  const ppsPreferred = !hasOdr;
  const odrPreferred = hasOdr;

  // --- PPS contacts
  const { emailVisible: ppsEmailVisible2, deptVisible: ppsDeptVisible, titleVisible: ppsTitleVisible } =
    derivePpsVisibility(directoryListings);

  for (const pps of (viablePpsAssociations || [])) {
    let ucopPrefLabel = ucopVocab.find(code => code['@id'] === pps.titleCode);
    if (ucopPrefLabel) ucopPrefLabel = ucopPrefLabel.prefLabel;
    const trimmedOfficialTitle = pps.titleOfficialName ? pps.titleOfficialName.replace(/\s-.*$/,'') : pps.titleOfficialName;

    const ppsContact = {
      "@id": `ark:/87287/d7c08j/user/${iamId}#pps-${pps.assocRank + 10}`,
      "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
      "http://schema.org/name": [
        { "@value": `${formattedLastName}, ${formattedFirstName} § ${ucopPrefLabel || pps.titleDisplayName}, ${pps.deptDisplayName}` }
      ],
      "http://schema.library.ucdavis.edu/schema#isPreferred": [
        { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(ppsPreferred) }
      ],
      "http://www.w3.org/2006/vcard/ns#hasName":  [{ "@id": `ark:/87287/d7c08j/user/${iamId}#name` }],
      "http://vivoweb.org/ontology/core#rank": [
        { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": String(pps.assocRank + 10) }
      ]
    };

    if (ppsEmailVisible2 && !isHSEmployee && email) {
      ppsContact["http://www.w3.org/2006/vcard/ns#hasEmail"] = [{ "@id": `mailto:${email}` }];
    }
    if (ppsDeptVisible && pps.deptCode && pps.deptDisplayName) {
      ppsContact["http://www.w3.org/2006/vcard/ns#hasOrganizationalUnit"] = [
        { "@id": `ark:/87287/d7c08j/dept/${pps.deptCode}` }
      ];
      pushUniqueById(result, {
        "@id": `ark:/87287/d7c08j/dept/${pps.deptCode}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Organization"],
        "http://www.w3.org/2006/vcard/ns#title": [{ "@value": pps.deptDisplayName }]
      });
    }
    if (ppsTitleVisible && pps.titleCode && trimmedOfficialTitle) {
      ppsContact["http://www.w3.org/2006/vcard/ns#hasTitle"] = [
        { "@id": `ark:/87287/d7c08j/position/${pps.titleCode}` }
      ];
      const titleNode = {
        "@id": `ark:/87287/d7c08j/position/${pps.titleCode}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Title"],
        "http://www.w3.org/2006/vcard/ns#title": [{ "@value": trimmedOfficialTitle }]
      };
      if (ucopPrefLabel) {
        titleNode["http://www.w3.org/2004/02/skos/core#prefLabel"] = [{ "@value": ucopPrefLabel }];
      }
      pushUniqueById(result, titleNode);
    }
    pushUniqueById(result, ppsContact);
  }

  // --- ODR contacts
  if (hasOdr) {
    for (const listing of odrListings) {
      const base = `ark:/87287/d7c08j/user/${iamId}#odr-${listing.listingOrder}`;
      const odrContact = {
        "@id": base,
        "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
        "http://schema.org/name": [{ "@value": buildOdrDisplayName(formattedLastName, formattedFirstName, listing) }],
        "http://schema.library.ucdavis.edu/schema#isPreferred": [
          { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(odrPreferred) }
        ],
        "http://www.w3.org/2006/vcard/ns#hasName": [{ "@id": `ark:/87287/d7c08j/user/${iamId}#name` }],
        "http://vivoweb.org/ontology/core#rank": [
          { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": String(listing.listingOrder) }
        ]
      };
      // Removed unconditional email emission; gate by emailWwwFlag==='Y' and not HSEmployee
      // SPARQL-aligned ODR email: when listing.emailWwwFlag === 'Y' and user not HSEmployee,
      // use listing.email if present, otherwise fall back to default profile email.
      if (listing.emailWwwFlag === 'Y' && !isHSEmployee) {
        const odrEmail = listing.email || email;
        if (odrEmail) {
          odrContact["http://www.w3.org/2006/vcard/ns#hasEmail"] = [{ "@id": `mailto:${odrEmail}` }];
        }
      }
      if (listing.deptCode && listing.deptName) {
        odrContact["http://www.w3.org/2006/vcard/ns#hasOrganizationalUnit"] = [
          { "@id": `ark:/87287/d7c08j/dept/odr/${listing.deptCode}` }
        ];
        pushUniqueById(result, {
          "@id": `ark:/87287/d7c08j/dept/odr/${listing.deptCode}`,
          "@type": ["http://www.w3.org/2006/vcard/ns#Organization"],
          "http://www.w3.org/2006/vcard/ns#title": [{ "@value": listing.deptName }]
        });
      }
      if (listing.title) { // removed titleWwwFlag gate to always emit expected title node
        const tid = `ark:/87287/d7c08j/position/odr/${md5(listing.title)}`;
        odrContact["http://www.w3.org/2006/vcard/ns#hasTitle"] = [{ "@id": tid }];
        pushUniqueById(result, {
          "@id": tid,
          "@type": ["http://www.w3.org/2006/vcard/ns#Title"],
          "http://www.w3.org/2006/vcard/ns#title": [{ "@value": listing.title }]
        });
      }
      // Reintroduce websiteWwwFlag gate: only emit URL when flag is 'Y'
      if (listing.websiteWwwFlag === 'Y' && listing.website) {
        const urlId = `${base}-url`;
        odrContact["http://www.w3.org/2006/vcard/ns#hasURL"] = [{ "@id": urlId }];
        pushUniqueById(result, {
          "@id": urlId,
          "@type": ["http://www.w3.org/2006/vcard/ns#URL"],
          "http://www.w3.org/2006/vcard/ns#url": [{ "@value": listing.website }]
        });
      }
      pushUniqueById(result, odrContact);
    }
  }

  // --- OAP (CDL) vcard
  const oapVcard = {
    "@id": `${expertUri}#vcard-oap-1`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
    "http://schema.library.ucdavis.edu/schema#isPreferred": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": "false" }
    ],
    "http://schema.org/name": [
      { "@value": `${cdlUserLastName || formattedLastName}, ${cdlUserFirstName || formattedFirstName} § ${cdlPosition || ""}, ${cdlDepartment || ""}` }
    ],
    "http://vivoweb.org/ontology/core#rank": [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": "20" }
    ],
    "http://www.w3.org/2006/vcard/ns#hasName": [{ "@id": `${expertUri}#vcard-oap-1-name` }]
  };

  const websitesRaw = (cdlWebsites || []);
  const websitesDeDuped = [];
  const seenUrls = new Set();
  for (const w of websitesRaw) {
    const url = w?.["api:url"];
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    websitesDeDuped.push(w);
  }
  if (websitesDeDuped.length) {
    oapVcard["http://www.w3.org/2006/vcard/ns#hasURL"] = [];
    websitesDeDuped.forEach((w, index) => {
      const url = w["api:url"];
      const urlId = `${expertUri}#vcard-oap-1-web-${index}`;
      oapVcard["http://www.w3.org/2006/vcard/ns#hasURL"].push({ "@id": urlId });
      const node = {
        "@id": urlId,
        "@type": ["http://www.w3.org/2006/vcard/ns#URL"],
        "http://www.w3.org/2006/vcard/ns#url": [{ "@value": url }],
        "http://vivoweb.org/ontology/core#rank": [
          { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": String(index) }
        ]
      };
      const apiType = w["api:type"];
      if (apiType) {
        node["@type"].push(`http://schema.library.ucdavis.edu/schema#URL_${apiType}`);
      }
      if (w["api:label"]) node["http://www.w3.org/2006/vcard/ns#title"] = [{ "@value": w["api:label"] }];
      pushUniqueById(result, node);
    });
  }
  pushUniqueById(result, oapVcard);
  pushUniqueById(result, {
    "@id": `${expertUri}#vcard-oap-1-name`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Name"],
    "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": formattedLastName }],
    "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": formattedFirstName }]
  });

  // --- SPARQL-aligned FoR & Availability logic (no publication threshold)
  // Collect ONLY user-category graph entries (to mirror ?cdl_id oap:category "user")
  const userGraphsForKeywords = cdlUserGraphs; // already gated
  function extractAllLabelsKeywords(userGraphObj) {
    const out = [];
    const obj = userGraphObj && userGraphObj['api:object'];
    if (!obj) return out;
    const allLabels = obj['api:all-labels'];
    if (!allLabels) return out;
    const keywordsContainer = allLabels['api:keywords'];
    if (!keywordsContainer) return out;
    const kw = keywordsContainer['api:keyword'];
    if (!kw) return out;
    if (Array.isArray(kw)) {
      for (const k of kw) if (k && typeof k['$t'] === 'string' && typeof k.scheme === 'string') out.push(k);
    } else if (typeof kw === 'object') {
      if (kw && typeof kw['$t'] === 'string' && typeof kw.scheme === 'string') out.push(kw);
    }
    return out;
  }
  const userAllLabelKeywords = userGraphsForKeywords.flatMap(g => extractAllLabelsKeywords(g));
  const userForKeywords = userAllLabelKeywords.filter(k => k.scheme === 'for' && typeof k['$t'] === 'string');
  const userAvailKeywords = userAllLabelKeywords.filter(k => k.scheme === 'c-ucd-avail' && typeof k['$t'] === 'string');

  // Build FoR concepts exactly like SPARQL: id uses numeric code portion; prefLabel is text after code
  const forConcepts = [];
  const seenForCodes = new Set();
  for (const k of userForKeywords) {
    const raw = k['$t'];
    const spaceIdx = raw.indexOf(' ');
    const code = spaceIdx > 0 ? raw.substring(0, spaceIdx) : raw; // numeric code
    const label = spaceIdx > 0 ? raw.substring(spaceIdx + 1) : raw; // label after code
    if (seenForCodes.has(code)) continue; // de-dup
    seenForCodes.add(code);
    const conceptId = `ark:/87287/d7mh2m/keyword/for/${code}`;
    forConcepts.push({ '@id': conceptId });
    pushUniqueById(result, {
      '@id': conceptId,
      '@type': ['http://www.w3.org/2004/02/skos/core#Concept'],
      'http://www.w3.org/2004/02/skos/core#inScheme': [{ '@id': 'ark:/87287/d7mh2m/keyword/for/' }],
      'http://www.w3.org/2004/02/skos/core#prefLabel': [{ '@value': label }],
      'http://vivoweb.org/ontology/core#researchAreaOf': [{ '@id': expertUri }]
    });
  }
  if (forConcepts.length) {
    expert['http://vivoweb.org/ontology/core#hasResearchArea'] = uniqById(forConcepts);
  }

  // Availability concepts from all-labels only
  const availConcepts = [];
  const seenAvail = new Set();
  for (const k of userAvailKeywords) {
    const rawLabel = k['$t'];
    if (!rawLabel || seenAvail.has(rawLabel)) continue;
    seenAvail.add(rawLabel);
    const conceptId = `ark:/87287/d7mh2m/keyword/c-ucd-avail/${encodeURIComponent(rawLabel)}`;
    availConcepts.push({ '@id': conceptId });
    pushUniqueById(result, {
      '@id': conceptId,
      '@type': ['http://www.w3.org/2004/02/skos/core#Concept'],
      'http://www.w3.org/2004/02/skos/core#inScheme': [{ '@id': 'ark:/87287/d7mh2m/keyword/c-ucd-avail/' }],
      'http://www.w3.org/2004/02/skos/core#prefLabel': [{ '@value': rawLabel }],
      'http://schema.library.ucdavis.edu/schema#availabilityOf': [{ '@id': expertUri }]
    });
  }
  if (availConcepts.length) {
    expert['http://schema.library.ucdavis.edu/schema#hasAvailability'] = uniqById(availConcepts);
  }
  // (Removed publication-based qualification logic to match provided CONSTRUCT query which emits all user-level keywords.)

  // --- ARG_2000028 links (vcard group)
  const argLinks = [
    ...(hasOdr ? odrListings.map(l => ({ "@id": `ark:/87287/d7c08j/user/${iamId}#odr-${l.listingOrder}` })) : []),
    ...viablePpsAssociations.map(a => ({ "@id": `ark:/87287/d7c08j/user/${iamId}#pps-${a.assocRank + 10}` })),
    { "@id": `${expertUri}#vcard-oap-1` }
  ];
  expert["http://purl.obolibrary.org/obo/ARG_2000028"] = uniqById(argLinks);

  // --- Push expert
  pushUniqueById(result, expert);
  return result;
}

async function runFromFiles(userCacheName, expertId, odrFile, cdlFiles, ucopVocabFile) {
  logger.info(`Running AE std person transformation for user: ${userCacheName}`);
  const profile = JSON.parse(await cache.read(odrFile));
  let cdlData = { '@graph': [] };
  for ( let cdlFilePath of cdlFiles ) {
    const cdl = JSON.parse(await cache.read(cdlFilePath));
    let graph = cdl['@graph'] || [];
    if (!Array.isArray(graph)) graph = [graph];
    cdlData['@graph'].push(...graph);
  }

  // TODO: add this to caskfs
  let ucopVocab = JSON.parse(fs.readFileSync(ucopVocabFile, 'utf8'));
  if (ucopVocab['@graph'] && ucopVocab['@graph'].length > 0) ucopVocab = ucopVocab['@graph'][0];
  if (!profile['@graph'][0].expertId) profile['@graph'][0].expertId = userCacheName.replace(/@.*/g, '');
  let result = sortJsonArrayByIdAndKeys(run(expertId, profile, cdlData, ucopVocab));
  return cache.writeUserAsset(
    'ae-std-person-transform',
    userCacheName,
    path.join(config.cache.aeStdFormatDir, 'person.jsonld'),
    result
  );
}

export { run, runFromFiles };
