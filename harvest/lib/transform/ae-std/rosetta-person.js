import jsonpath from 'jsonpath';
import fs from 'fs';
import cache from '../../cache.js';
import { config, logger } from '@ucd-lib/experts-commons';
import path from 'path';

import { sortJsonArrayByIdAndKeys, asArray } from '../utils.js';

// ---- helpers (kept local/independent from person.js by design) ----
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

/**
 * @function run
 * @description Pure transform: converts a rosetta IAM profile object (the new, flatter
 * shape - no ODR/directory block) plus joined CDL/Elements data into the same flat
 * vcard-style JSON-LD array that the legacy person.js transform produces.
 *
 * @param {String} expertId - Expert ark identifier suffix (from keycloak)
 * @param {Object} profile - A single rosetta profile object (not wrapped in @graph)
 * @param {Object} cdl - Joined CDL/Elements graph, shape {'@graph': [...]}
 * @param {Array|Object} ucopVocab - UCOP title-code vocabulary
 * @returns {Object} {result, isPublic, odrPrivacy, cdlPrivacy, noPPSAssociations, privacyAttributes}
 */
function run(expertId, profile, cdl, ucopVocab) {
  const result = [];
  const expertUri = `http://experts.ucdavis.edu/expert/${expertId}`;
  const privacyAttributes = [];

  // --- Basic profile pulls (new flatter shape - no @graph/jsonpath needed)
  const iamId     = profile.iam_id;
  const iamUserId = profile?.id?.login_id;
  const email     = profile?.email?.campus;
  const firstName  = profile?.name?.lived_first_name;
  const middleName = profile?.name?.lived_middle_name;
  const lastName   = profile?.name?.lived_last_name;
  const pronouns   = profile?.name?.lived_pronouns;

  // Normalize ALL-CAPS first/middle/last (>=2 chars) to Capitalized (e.g. WILLIAM -> William)
  const normalizeAllCaps = s =>
    (typeof s === 'string' && /^[A-Z][A-Z\-']+$/.test(s))
      ? (s.charAt(0) + s.slice(1).toLowerCase())
      : s;
  const formattedFirstName = normalizeAllCaps(firstName);
  const formattedMiddleName = normalizeAllCaps(middleName);
  const formattedLastName = normalizeAllCaps(lastName);

  const employeeAssociations = asArray(profile.employee_association);
  // No ODR/directory block exists in the new shape, so gate solely on employee_association
  // having the fields needed to build a PPS vcard (mirrors the legacy viablePpsAssociations gate).
  const viableEmployeeAssociations = employeeAssociations.filter(a => a &&
    a.position_title &&
    a.job_type_id &&
    a.department_id &&
    (a.department_title || a.department_short_title)
  );
  if (!viableEmployeeAssociations.length) {
    logger.warn(`No viable employee associations found for user ${expertId} (found ${employeeAssociations.length} total, ${viableEmployeeAssociations.length} with required fields)`);
    return {
      result: [],
      isPublic: false,
      noPPSAssociations: true,
      odrPrivacy: null,
      cdlPrivacy: null,
      privacyAttributes
    };
  }

  // isHSEmployee: true if any viable association is flagged as a health-system position.
  const isHSEmployee = viableEmployeeAssociations.some(a => a.is_health_position === 'Y');
  // isFaculty: no direct boolean in the new shape. Heuristic sniff on classification text
  // until the real employee_classification codes for faculty are known.
  const isFaculty = viableEmployeeAssociations.some(a =>
    typeof a.employee_classification_description === 'string' &&
    /faculty/i.test(a.employee_classification_description)
  );

  // --- CDL/Elements join (unchanged from legacy person.js - unrelated to IAM shape change)
  const cdlUserGraphs = asArray(cdl['@graph']);
  const cdlUserGraph = cdlUserGraphs[0];
  const cdlObj = (cdlUserGraph && (cdlUserGraph['api:object'] || cdlUserGraph)) || {};

  const cdlUsername = cdlObj && (cdlObj['api:username'] || cdlObj['username']);
  const joinedUserId = cdlUsername && /@ucdavis\.edu$/i.test(cdlUsername)
    ? cdlUsername.replace(/@ucdavis\.edu$/i, '')
    : null;

  if (!iamUserId || !joinedUserId || iamUserId !== joinedUserId) {
    logger.warn(`Gating check failed for user ${expertId}: iamUserId=${iamUserId}, joinedUserId=${joinedUserId}`);
  }

  const cdlPrivacyLevel = cdlObj['api:privacy-level'] || cdlObj['privacy-level'];
  const legacyIsPublic = cdlObj['api:is-public'];
  const cdlIsPublic = (legacyIsPublic !== undefined)
    ? (legacyIsPublic === 'true' || legacyIsPublic === true)
    : (cdlPrivacyLevel === 'Public');
  const cdlIsLoginAllowed = cdlObj['api:is-login-allowed'] === 'true' || cdlObj['api:is-login-allowed'] === true;
  const cdlCategory = cdlObj['category'];
  const cdlUserFirstName = cdlObj['api:first-name'] || cdlObj['first-name'];
  const cdlUserLastName  = cdlObj['api:last-name']  || cdlObj['last-name'];
  const cdlDepartment    = cdlObj['api:department'] || cdlObj['department'];
  const cdlPosition      = cdlObj['api:position']   || cdlObj['position'];
  const cdlUserId        = cdlObj.id;

  const cdlPrivacy = {
    'is-public': cdlIsPublic,
    'privacy-level': cdlPrivacyLevel,
    'is-login-allowed': cdlIsLoginAllowed,
    category: cdlCategory || null,
    value : (cdlIsPublic && cdlPrivacyLevel === 'Public' && cdlIsLoginAllowed && cdlCategory === 'user')
  }

  const nativeFields = jsonpath.query(cdlObj, '$["api:records"]["api:record"]["api:native"]["api:field"]') || [];
  const flattenNative = Array.isArray(nativeFields) ? nativeFields.flatMap(f => Array.isArray(f) ? f : [f]) : [];
  function extractFieldText(name) {
    const node = flattenNative.find(f => f && f.name === name);
    const textNode = node && node['api:text'];
    if( !textNode ) return null;
    privacyAttributes.push({name, level: textNode['privacy']});
    if( textNode['privacy'] !== 'public' ) return null;
    return textNode['$t'] || null;
  }
  const cdlOverview          = extractFieldText('overview');
  const cdlResearchInterests = extractFieldText('research-interests');
  const cdlTeachingSummary   = extractFieldText('teaching-summary');

  const websiteFields = flattenNative.filter(f => f && f.name === 'personal-websites');
  const cdlWebsites = websiteFields
    .flatMap(field => asArray(field['api:web-addresses']?.['api:web-address']))
    .filter(w => {
      if( w && w['privacy'] ) {
        privacyAttributes.push({name: 'personal-websites', level: w['privacy'], value: w['api:url']});
      }
      return (w && w['privacy'] === 'public')
    })

  const assocNodes = jsonpath.query(cdlObj, '$["api:user-identifier-associations"]["api:user-identifier-association"]') || [];
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
  // No ODR visibility concept exists anymore - isPublic is driven by CDL privacy alone.
  const isPublic = cdlPrivacy.value;

  const expert = {
    "@id": expertUri,
    "@type": [
      "http://schema.library.ucdavis.edu/schema#Expert",
      "http://schema.org/Person",
      expertType
    ],
    "http://www.w3.org/2000/01/rdf-schema#label": [{ "@value": `${formattedLastName}, ${formattedFirstName}` }],
    "http://schema.library.ucdavis.edu/schema#is-visible": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(isPublic) }
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

  // --- schema:identifier. No ODR WWW-flags exist anymore, so email is always considered visible.
  const ppsEmailVisible = true;
  const titleVisible = true;
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

  // --- PPS contacts (there is no ODR source anymore, so the PPS/employee vcard is always preferred)
  const ppsPreferred = true;

  /**
   * @function assocRank
   * @description Derive a legacy-style rank integer from employee_record (0-based record number).
   * Assumption: employee_record "0" maps to the same #pps-11 id the legacy transform produced
   * for a single-association user (legacy assocRank 1 -> #pps-11). Verify once a multi-association
   * user is available.
   */
  function assocRank(assoc, index) {
    const n = parseInt(assoc.employee_record, 10);
    return (Number.isFinite(n) ? n : index) + 1;
  }

  viableEmployeeAssociations.forEach((assoc, index) => {
    const rank = assocRank(assoc, index);
    const ucopVocabArray = Array.isArray(ucopVocab) ? ucopVocab : [];
    let ucopPrefLabel = ucopVocabArray.find(code => code['@id'] === assoc.job_type_id);
    if (ucopPrefLabel) ucopPrefLabel = ucopPrefLabel.prefLabel;
    const trimmedOfficialTitle = (assoc.position_title || '').replace(/\s-.*$/, '');
    const deptDisplayName = assoc.department_title || assoc.department_short_title;

    const ppsContact = {
      "@id": `ark:/87287/d7c08j/user/${iamId}#pps-${rank + 10}`,
      "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
      "http://schema.org/name": [
        { "@value": `${formattedLastName}, ${formattedFirstName} § ${ucopPrefLabel || assoc.position_title}, ${deptDisplayName}` }
      ],
      "http://schema.library.ucdavis.edu/schema#isPreferred": [
        { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(ppsPreferred) }
      ],
      "http://www.w3.org/2006/vcard/ns#hasName":  [{ "@id": `ark:/87287/d7c08j/user/${iamId}#name` }],
      "http://vivoweb.org/ontology/core#rank": [
        { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": String(rank + 10) }
      ]
    };

    if (ppsEmailVisible && !isHSEmployee && email) {
      ppsContact["http://www.w3.org/2006/vcard/ns#hasEmail"] = [{ "@id": `mailto:${email}` }];
    }
    if (assoc.department_id && deptDisplayName) {
      ppsContact["http://www.w3.org/2006/vcard/ns#hasOrganizationalUnit"] = [
        { "@id": `ark:/87287/d7c08j/dept/${assoc.department_id}` }
      ];
      pushUniqueById(result, {
        "@id": `ark:/87287/d7c08j/dept/${assoc.department_id}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Organization"],
        "http://www.w3.org/2006/vcard/ns#title": [{ "@value": deptDisplayName }]
      });
    }
    if (titleVisible && assoc.job_type_id && trimmedOfficialTitle) {
      ppsContact["http://www.w3.org/2006/vcard/ns#hasTitle"] = [
        { "@id": `ark:/87287/d7c08j/position/${assoc.job_type_id}` }
      ];
      const titleNode = {
        "@id": `ark:/87287/d7c08j/position/${assoc.job_type_id}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Title"],
        "http://www.w3.org/2006/vcard/ns#title": [{ "@value": trimmedOfficialTitle }]
      };
      if (ucopPrefLabel) {
        titleNode["http://www.w3.org/2004/02/skos/core#prefLabel"] = [{ "@value": ucopPrefLabel }];
      }
      pushUniqueById(result, titleNode);
    }
    pushUniqueById(result, ppsContact);
  });

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

  const oapFamilyName = cdlUserLastName || formattedLastName;
  const oapGivenName = cdlUserFirstName || formattedFirstName;
  pushUniqueById(result, {
    "@id": `${expertUri}#vcard-oap-1-name`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Name"],
    "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": oapFamilyName }],
    "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": oapGivenName }]
  });

  // --- FoR & Availability keywords (unchanged from legacy - CDL-sourced, not IAM-shape dependent)
  const userGraphsForKeywords = cdlUserGraphs;
  function extractAllLabelsKeywords(userGraphObj) {
    const out = [];
    const obj = userGraphObj && (userGraphObj['api:object'] || userGraphObj);
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

  const forConcepts = [];
  const seenForCodes = new Set();
  for (const k of userForKeywords) {
    const raw = k['$t'];
    const spaceIdx = raw.indexOf(' ');
    const code = spaceIdx > 0 ? raw.substring(0, spaceIdx) : raw;
    const label = spaceIdx > 0 ? raw.substring(spaceIdx + 1) : raw;
    if (seenForCodes.has(code)) continue;
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

  // --- ARG_2000028 links (vcard group). No ODR contacts exist anymore.
  const argLinks = [
    ...viableEmployeeAssociations.map((a, index) => ({ "@id": `ark:/87287/d7c08j/user/${iamId}#pps-${assocRank(a, index) + 10}` })),
    { "@id": `${expertUri}#vcard-oap-1` }
  ];
  expert["http://purl.obolibrary.org/obo/ARG_2000028"] = uniqById(argLinks);

  pushUniqueById(result, expert);
  return {
    result,
    isPublic,
    odrPrivacy: null,
    cdlPrivacy,
    noPPSAssociations: false,
    privacyAttributes
  };
}

/**
 * @function toPerson
 * @description I/O wrapper: reads the cached rosetta profile and CDL jsonld files from cask
 * cache, calls run(), sorts the result, and writes it to ae-std/rosetta-person.jsonld.
 *
 * @param {String} userCacheName - user cask cache key (email)
 * @param {String} expertId - expert ark identifier suffix (from keycloak)
 * @param {String} rosettaProfileFile - cask path to the cached raw rosetta profile response
 * @param {Array<String>} cdlFiles - cask paths to joined CDL jsonld files
 * @param {String} ucopVocabFile - local path to the UCOP title-code vocabulary file
 * @returns {Promise<Object>} {isPublic, odrPrivacy, cdlPrivacy, privacyAttributes, noPPSAssociations}
 */
async function toPerson(userCacheName, expertId, rosettaProfileFile, cdlFiles, ucopVocabFile) {
  logger.info(`Running rosetta AE std person transformation for user: ${userCacheName}`);

  const raw = JSON.parse(await cache.read(rosettaProfileFile));
  const profile = Array.isArray(raw) ? raw[0] : raw;

  let cdlData = { '@graph': [] };
  for ( let cdlFilePath of cdlFiles ) {
    logger.info(`Processing person file: ${cdlFilePath}`);
    const cdl = JSON.parse(await cache.read(cdlFilePath));
    let graph = cdl['@graph'] || [];
    if (!Array.isArray(graph)) graph = [graph];
    cdlData['@graph'].push(...graph);
  }

  let ucopVocab = JSON.parse(fs.readFileSync(ucopVocabFile, 'utf8'));
  if (ucopVocab['@graph'] && ucopVocab['@graph'].length > 0) ucopVocab = ucopVocab['@graph'][0];

  let {result, isPublic, odrPrivacy, cdlPrivacy, privacyAttributes, noPPSAssociations} = run(expertId, profile, cdlData, ucopVocab);
  result = sortJsonArrayByIdAndKeys(result);

  await cache.writeUserAsset(
    userCacheName,
    path.join(config.cache.aeStdFormatDir, 'rosetta-person.jsonld'),
    result
  );

  if( !isPublic ) {
    logger.info(`Result for user ${userCacheName} is not public. CDL privacy=${JSON.stringify(cdlPrivacy)}`);
  }

  return {isPublic, odrPrivacy, cdlPrivacy, privacyAttributes, noPPSAssociations};
}

export { run, toPerson };
