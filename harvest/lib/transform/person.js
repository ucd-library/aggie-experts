import jsonpath from 'jsonpath';
import fs from 'fs';
import md5 from 'md5';
import cache from '../cache.js';
import config from '../config.js';
import logger from '../logger.js';
import path from 'path';

import {sortJsonArrayByIdAndKeys} from './utils.js';

// ---- helpers ----
const uniq = arr => Array.from(new Set((arr || []).filter(v => v != null)));

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
  const hasDept  = listing.deptName && listing.deptWwwFlag !== 'N';
  const hasWeb   = listing.website && listing.websiteWwwFlag === 'Y';
  const hasEmail = listing.emailWwwFlag === 'Y'; // explicit email optional
  return Boolean(hasTitle || hasDept || hasWeb || hasEmail);
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
  const email        = jsonpath.value(profile, '$["@graph"][0].email');
  const firstName    = jsonpath.value(profile, '$["@graph"][0].dFirstName');
  const middleName   = jsonpath.value(profile, '$["@graph"][0].dMiddleName');
  const lastName     = jsonpath.value(profile, '$["@graph"][0].dLastName');
  const isFaculty    = jsonpath.value(profile, '$["@graph"][0].isFaculty') || false;
  const isHSEmployee = jsonpath.value(profile, '$["@graph"][0].isHSEmployee') || false;
  const pronouns     = jsonpath.value(profile, '$["@graph"][0].directory.displayName.preferredPronouns');

  const ppsAssociations   = jsonpath.value(profile, '$["@graph"][0].ppsAssociations') || [];
  const directoryListings = jsonpath.value(profile, '$["@graph"][0].directory.listings') || [];

  // ODR visibility gate (SPARQL sets ?odr_is_visible via nameWwwFlag=N ⇒ false)
  const odrNameWwwFlag = jsonpath.value(profile, '$["@graph"][0].directory.displayName.nameWwwFlag');
  const odrIsVisible   = odrNameWwwFlag === 'N' ? false : true;

  // --- CDL pulls
  const researchAreas = (jsonpath.query(cdl, '$["@graph"][0]["api:object"]["api:all-labels"]["api:keywords"]["api:keyword"][*]') || [])
    .filter(area => area.scheme === 'for');

  const availabilities = (jsonpath.query(cdl, '$["@graph"][0]["api:object"]["api:all-labels"]["api:keywords"]["api:keyword"][*]') || [])
    .filter(area => area.scheme === 'c-ucd-avail');

  const cdlUserFirstName = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:first-name"]');
  const cdlUserLastName  = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:last-name"]');
  const cdlDepartment    = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:department"]');
  const cdlPosition      = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:position"]');
  const cdlUserId        = jsonpath.value(cdl, '$["@graph"][0]["api:object"].id');
  const cdlOverview      = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:records"]["api:record"]["api:native"]["api:field"][?(@.name=="overview")]["api:text"]["$t"]');
  const cdlResearchInterests = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:records"]["api:record"]["api:native"]["api:field"][?(@.name=="research-interests")]["api:text"]["$t"]');
  const cdlTeachingSummary  = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:records"]["api:record"]["api:native"]["api:field"][?(@.name=="teaching-summary")]["api:text"]["$t"]');

  // Extract websites from that messy CDL field array
  const fieldsRaw = jsonpath.query(cdl, '$..["@graph"][0]["api:object"]["api:records"]["api:record"]["api:native"]["api:field"]');
  const fields = Array.isArray(fieldsRaw)
    ? fieldsRaw.flatMap(f => Array.isArray(f) ? f : [f])
    : [];
  const cdlWebsites = fields
    .filter(field => field && field.name === "personal-websites")
    .flatMap(field => (field["api:web-addresses"]?.["api:web-address"]) ? field["api:web-addresses"]["api:web-address"] : []);

  const orcidId      = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:user-identifier-associations"]["api:user-identifier-association"][?(@.scheme=="orcid")]["$t"]');
  const scopusId     = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:user-identifier-associations"]["api:user-identifier-association"][?(@.scheme=="scopus-author-id")]["$t"]');
  const researcherId = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:user-identifier-associations"]["api:user-identifier-association"][?(@.scheme=="researcherid")]["$t"]');

  // --- Name variations
  const nameMatches = uniq([
    `${lastName.toLowerCase()}_${firstName.charAt(0).toLowerCase()}`,
    `${lastName.toLowerCase()}_${firstName.charAt(0).toLowerCase()}${middleName ? middleName.charAt(0).toLowerCase() : ''}`,
    `${lastName.toLowerCase()}_${firstName.toLowerCase()}`,
    `${lastName.toLowerCase()}_${firstName.toLowerCase()}${middleName ? middleName.charAt(0).toLowerCase() : ''}`
  ]);

  // --- Expert node
  const expertType = (isFaculty ? "http://vivoweb.org/ontology/core#FacultyMember" : "http://vivoweb.org/ontology/core#NonAcademic");

  const expert = {
    "@id": expertUri,
    "@type": [
      "http://schema.library.ucdavis.edu/schema#Expert",
      "http://schema.org/Person",
      expertType
    ],
    "http://www.w3.org/2000/01/rdf-schema#label": [{ "@value": `${lastName}, ${firstName}` }],
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
  if (scopusId) expert["http://vivoweb.org/ontology/core#scopusId"]     = [{ "@value": scopusId }];
  if (researcherId) expert["http://vivoweb.org/ontology/core#researcherId"] = [{ "@value": researcherId }];
  if (cdlOverview) expert["http://vivoweb.org/ontology/core#overview"] = [{ "@value": cdlOverview }];
  if (cdlResearchInterests) expert["http://schema.library.ucdavis.edu/schema#researchInterests"] = [{ "@value": cdlResearchInterests }];
  if (cdlTeachingSummary)  expert["http://schema.library.ucdavis.edu/schema#teachingSummary"]   = [{ "@value": cdlTeachingSummary }];

  // --- schema:identifier (gate mailto like SPARQL)
  // pps_email_v: if directory.emailWwwFlag == 'N' and no explicit ODR email, false; else true
  const anyListingEmailY = (directoryListings || []).some(l => l?.emailWwwFlag === 'Y');
  const ppsEmailAllowed  = anyListingEmailY || (directoryListings || []).every(l => l?.emailWwwFlag !== 'N');
  const identifiers = [
    { "@id": expertUri },
    { "@id": `ark:/87287/d7c08j/user/${iamId}` },
    { "@id": `ark:/87287/d7mh2m/user/${cdlUserId}` },
    ...(ppsEmailAllowed && !isHSEmployee && email ? [{ "@id": `mailto:${email}` }] : []),
    ...(orcidId ? [{ "@id": `http://orcid.org/${orcidId}` }] : []),
    ...(scopusId ? [{ "@id": `https://www.scopus.com/authid/detail.uri?authorId=${scopusId}` }] : []),
    ...(researcherId ? [{ "@id": `https://www.webofscience.com/wos/author/record/${researcherId}` }] : [])
  ];
  expert["http://schema.org/identifier"] = uniqById(identifiers);

  // --- Name record
  const nameRecord = {
    "@id": `ark:/87287/d7c08j/user/${iamId}#name`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Name"],
    "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": lastName }],
    "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": firstName }]
  };
  if (middleName) nameRecord["http://www.w3.org/2006/vcard/ns#middleName"] = [{ "@value": middleName }];
  if (pronouns)   nameRecord["http://www.w3.org/2006/vcard/ns#pronouns"]   = [{ "@value": pronouns }];
  pushUniqueById(result, nameRecord);

  // --- ODR listings: keep only usable/public ones
  const odrListings = (directoryListings || []).filter(hasUsableOdr);
  const hasOdr = odrListings.length > 0;

  // PPS preferred iff no ODR; ODR preferred iff ODR exists
  const ppsPreferred = !hasOdr;
  const odrPreferred = hasOdr;

  // --- PPS contacts (non-preferred if ODR exists)
  const { emailVisible: ppsEmailVisible, deptVisible: ppsDeptVisible, titleVisible: ppsTitleVisible } =
    derivePpsVisibility(directoryListings);

  for (const pps of (ppsAssociations || [])) {
    let ucopPrefLabel = ucopVocab.find(code => code['@id'] === pps.titleCode);
    if (ucopPrefLabel) ucopPrefLabel = ucopPrefLabel.prefLabel;

    const ppsContact = {
      "@id": `ark:/87287/d7c08j/user/${iamId}#pps-${pps.assocRank + 10}`,
      "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
      "http://schema.org/name": [
        { "@value": `${lastName}, ${firstName} § ${ucopPrefLabel || pps.titleDisplayName}, ${pps.deptDisplayName}` }
      ],
      "http://schema.library.ucdavis.edu/schema#isPreferred": [
        { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(ppsPreferred) }
      ],
      "http://www.w3.org/2006/vcard/ns#hasName":  [{ "@id": `ark:/87287/d7c08j/user/${iamId}#name` }],
      "http://vivoweb.org/ontology/core#rank": [
        { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": String(pps.assocRank + 10) }
      ]
    };

    // PPS email only if visible *and* not HSE (matches SPARQL intent)
    if (ppsEmailVisible && !isHSEmployee && email) {
      ppsContact["http://www.w3.org/2006/vcard/ns#hasEmail"] = [{ "@id": `mailto:${email}` }];
    }

    // PPS dept only if visible AND we actually have code+name
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

    // PPS title only if visible AND we have a titleCode/titleOfficialName
    if (ppsTitleVisible && pps.titleCode && pps.titleOfficialName) {
      ppsContact["http://www.w3.org/2006/vcard/ns#hasTitle"] = [
        { "@id": `ark:/87287/d7c08j/position/${pps.titleCode}` }
      ];
      const titleNode = {
        "@id": `ark:/87287/d7c08j/position/${pps.titleCode}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Title"],
        "http://www.w3.org/2006/vcard/ns#title": [{ "@value": pps.titleOfficialName }]
      };
      if (ucopPrefLabel) {
        titleNode["http://www.w3.org/2004/02/skos/core#prefLabel"] = [{ "@value": ucopPrefLabel }];
      }
      pushUniqueById(result, titleNode);
    }

    pushUniqueById(result, ppsContact);
  }

  // --- ODR contacts (only when hasOdr)
  if (hasOdr) {
    for (const listing of odrListings) {
      const base = `ark:/87287/d7c08j/user/${iamId}#odr-${listing.listingOrder}`;
      const odrContact = {
        "@id": base,
        "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
        "http://schema.org/name": [{ "@value": buildOdrDisplayName(lastName, firstName, listing) }],
        "http://schema.library.ucdavis.edu/schema#isPreferred": [
          { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(odrPreferred) }
        ],
        "http://www.w3.org/2006/vcard/ns#hasName": [{ "@id": `ark:/87287/d7c08j/user/${iamId}#name` }],
        "http://vivoweb.org/ontology/core#rank": [
          { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": String(listing.listingOrder) }
        ]
      };

      // Email (ODR email must be public to include)
      if (listing.emailWwwFlag === 'Y' && email) {
        odrContact["http://www.w3.org/2006/vcard/ns#hasEmail"] = [{ "@id": `mailto:${email}` }];
      }

      // Dept node if public and present
      if (listing.deptWwwFlag !== 'N' && listing.deptCode && listing.deptName) {
        odrContact["http://www.w3.org/2006/vcard/ns#hasOrganizationalUnit"] = [
          { "@id": `ark:/87287/d7c08j/dept/odr/${listing.deptCode}` }
        ];
        pushUniqueById(result, {
          "@id": `ark:/87287/d7c08j/dept/odr/${listing.deptCode}`,
          "@type": ["http://www.w3.org/2006/vcard/ns#Organization"],
          "http://www.w3.org/2006/vcard/ns#title": [{ "@value": listing.deptName }]
        });
      }

      // Title node if public and present
      if (listing.titleWwwFlag !== 'N' && listing.title) {
        const tid = `ark:/87287/d7c08j/position/odr/${md5(listing.title)}`;
        odrContact["http://www.w3.org/2006/vcard/ns#hasTitle"] = [{ "@id": tid }];
        pushUniqueById(result, {
          "@id": tid,
          "@type": ["http://www.w3.org/2006/vcard/ns#Title"],
          "http://www.w3.org/2006/vcard/ns#title": [{ "@value": listing.title }]
        });
      }

      // Website from the *directory listing* only, and only if public
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
      { "@value": `${cdlUserLastName}, ${cdlUserFirstName} § ${cdlPosition || ""}, ${cdlDepartment || ""}` }
    ],
    "http://vivoweb.org/ontology/core#rank": [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": "20" }
    ],
    "http://www.w3.org/2006/vcard/ns#hasName": [{ "@id": `${expertUri}#vcard-oap-1-name` }],
    "http://www.w3.org/2006/vcard/ns#hasURL": []
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

    // restore old metadata:
    if (w["api:type"] === "other") {
      node["@type"].push("http://schema.library.ucdavis.edu/schema#URL_other");
    }
    if (w["api:label"]) {
      node["http://www.w3.org/2006/vcard/ns#title"] = [{ "@value": w["api:label"] }];
    }

    pushUniqueById(result, node);
  });

  // Ensure the OAP vCard itself is emitted (even if there are 0 websites)
  pushUniqueById(result, oapVcard);

  // OAP name record
  pushUniqueById(result, {
    "@id": `${expertUri}#vcard-oap-1-name`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Name"],
    "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": lastName }],
    "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": firstName }]
  });

  // --- Concepts (nodes) + links
  const hasResearchArea = uniqById(researchAreas.map(area => ({
    "@id": `ark:/87287/d7mh2m/keyword/for/${area['$t'].split(' ')[0]}`
  })));
  if (hasResearchArea.length) {
    expert["http://vivoweb.org/ontology/core#hasResearchArea"] = hasResearchArea;
    // nodes themselves
    researchAreas.forEach(area => {
      const conceptId = `ark:/87287/d7mh2m/keyword/for/${area['$t'].split(' ')[0]}`;
      pushUniqueById(result, {
        "@id": conceptId,
        "@type": ["http://www.w3.org/2004/02/skos/core#Concept"],
        "http://www.w3.org/2004/02/skos/core#inScheme": [{ "@id": "ark:/87287/d7mh2m/keyword/for/" }],
        "http://www.w3.org/2004/02/skos/core#prefLabel": [
          { "@value": area['$t'].substring(area['$t'].indexOf(' ') + 1) }
        ],
        "http://vivoweb.org/ontology/core#researchAreaOf": [{ "@id": expertUri }]
      });
    });
  }

  const hasAvailability = uniqById(availabilities.map(area => ({
    "@id": `ark:/87287/d7mh2m/keyword/c-ucd-avail/${encodeURIComponent(area['$t'])}`
  })));
  if (hasAvailability.length) {
    expert["http://schema.library.ucdavis.edu/schema#hasAvailability"] = hasAvailability;
    availabilities.forEach(area => {
      const conceptId = `ark:/87287/d7mh2m/keyword/c-ucd-avail/${encodeURIComponent(area['$t'])}`;
      pushUniqueById(result, {
        "@id": conceptId,
        "@type": ["http://www.w3.org/2004/02/skos/core#Concept"],
        "http://www.w3.org/2004/02/skos/core#inScheme": [{ "@id": "ark:/87287/d7mh2m/keyword/c-ucd-avail/" }],
        "http://www.w3.org/2004/02/skos/core#prefLabel": [{ "@value": area['$t'] }],
        "http://schema.library.ucdavis.edu/schema#availabilityOf": [{ "@id": expertUri }]
      });
    });
  }

  // --- ARG_2000028 links (vcard group): odr (if any) + pps + oap
  const argLinks = [
    ...(hasOdr ? odrListings.map(l => ({ "@id": `ark:/87287/d7c08j/user/${iamId}#odr-${l.listingOrder}` })) : []),
    ...ppsAssociations.map(a => ({ "@id": `ark:/87287/d7c08j/user/${iamId}#pps-${a.assocRank + 10}` })),
    { "@id": `${expertUri}#vcard-oap-1` }
  ];
  expert["http://purl.obolibrary.org/obo/ARG_2000028"] = uniqById(argLinks);

  // --- Push the expert last (after we created referenced nodes)
  pushUniqueById(result, expert);

  return result;
}

async function runFromFiles(userCacheName, expertId, odrFile, cdlFiles, ucopVocabFile) {
  logger.info(`Running AE std person transformation for user: ${userCacheName}`);

  const profile = JSON.parse(await cache.read(odrFile));

  let cdlData = {
    '@graph': []
  }

  for( let cdlFilePath of cdlFiles ) {
    const cdl = JSON.parse(await cache.read(cdlFilePath));

    let graph = cdl['@graph'] || [];
    if (!Array.isArray(graph)) {
      graph = [graph];
    }

    cdlData['@graph'].push(...graph);
  }

  // TODO: add this to caskfs
  let ucopVocab = JSON.parse(fs.readFileSync(ucopVocabFile, 'utf8'));
  if( ucopVocab['@graph'] && ucopVocab['@graph'].length > 0 ) {
    ucopVocab = ucopVocab['@graph'][0];
  }

  if( !profile['@graph'][0].expertId ) {
    profile['@graph'][0].expertId = userCacheName.replace(/@.*/g, '');
  }

  let result = sortJsonArrayByIdAndKeys(run(expertId, profile, cdlData, ucopVocab));
  return cache.writeUserAsset(
    'ae-std-person-transform',
    userCacheName,
    path.join(config.cache.aeStdFormatDir, 'person.jsonld'),
    result
  );
}

export { run, runFromFiles };
