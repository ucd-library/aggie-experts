import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, getFieldObject } from './utils.js';

const ROLE_TYPES = {
  PI: 'http://vivoweb.org/ontology/core#PrincipalInvestigatorRole',
  CO_PI: 'http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole',
  RESEARCHER: 'http://vivoweb.org/ontology/core#ResearcherRole',
  LEADER: 'http://vivoweb.org/ontology/core#LeaderRole'
};

const GRANT_TYPES = {
  ACADEMIC_SUPPORT: 'http://schema.library.ucdavis.edu/schema#Grant_AcademicSupport',
  DEFAULT: 'http://schema.library.ucdavis.edu/schema#Grant_Default',
  INSTRUCTION: 'http://schema.library.ucdavis.edu/schema#Grant_Instruction',
  RESEARCH: 'http://schema.library.ucdavis.edu/schema#Grant_Research',
  SERVICE: 'http://schema.library.ucdavis.edu/schema#Grant_Service',
  SCHOLARSHIP: 'http://schema.library.ucdavis.edu/schema#Grant_Scholarship',
  STUDENT_SERVICE: 'http://schema.library.ucdavis.edu/schema#Grant_StudentService'
};

const ONTOLOGY = {
  GRANT: 'http://vivoweb.org/ontology/core#Grant',
  FUNDING_ORG: 'http://vivoweb.org/ontology/core#FundingOrganization',
  GRANT_ROLE: 'http://schema.library.ucdavis.edu/schema#GrantRole',
  RELATES: 'http://vivoweb.org/ontology/core#relates',
  RELATED_BY: 'http://vivoweb.org/ontology/core#relatedBy',
  ASSIGNED_BY: 'http://vivoweb.org/ontology/core#assignedBy',
  DATE_TIME_INTERVAL: 'http://vivoweb.org/ontology/core#dateTimeInterval',
  DATE_TIME: 'http://vivoweb.org/ontology/core#dateTime',
  START: 'http://vivoweb.org/ontology/core#start',
  END: 'http://vivoweb.org/ontology/core#end',
  YEAR_MONTH_DAY_PRECISION: 'http://vivoweb.org/ontology/core#yearMonthDayPrecision',
  TOTAL_AWARD_AMOUNT: 'http://vivoweb.org/ontology/core#totalAwardAmount',
  SPONSOR_AWARD_ID: 'http://vivoweb.org/ontology/core#sponsorAwardId'
};

function capitalizeName(name) {
  if (!name) return '';

  const isAllUpperCase = name === name.toUpperCase();
  const isAllLowerCase = name === name.toLowerCase();

  if (isAllUpperCase || isAllLowerCase) {
    const lowerName = name.toLowerCase();
    const words = lowerName.split(' ');

    // Capitalize each word and handle hyphenated and apostrophized parts
    const capitalizedWords = words.map(word => {
      const capitalizeParts = (word, delimiter) => {
        return word.split(delimiter).map(part => {
          if (part.length === 0) return part;
          return part[0].toUpperCase() + part.slice(1);
        }).join(delimiter);
      };

      word = capitalizeParts(word, '-');
      word = capitalizeParts(word, '\'');

      return word;
    });

    return capitalizedWords.join(' ');
  }

  return name;
}

function capitalizeTitle(title) {
  if (!title) return '';

  const acronymsList = [
    "CA", "CDPH", "ACS", "AbbVie", "PHS", "GSK", "NIMH", "FAA", "US", "MRPI",
    "UCRI", "EPA", "UT", "UC","NIH","NCI", "NIAID", "NIDCR", "NIDDK", "NHLBI",
    "NIMH", "NINDS", "NLM", "NICHD", "NIGMS", "NEI", "NIEHS", "NIAAA", "NIA",
    "NIAMS", "NINR", "NIDCD", "NHGRI", "NIBIB", "NIMHD",
    'CDC', 'CIA', 'DARPA', 'DOD', 'DOE', 'EPA', 'ESA', 'EU', 'FBI',
    'IMF', 'JPL', 'NASA', 'NIH', 'NOAA', 'NSERC', 'NSF', 'OECD',
    'OPEC', 'UN', 'UNESCO', 'UNICEF', 'USA', 'USDA', 'WHO', 'WTO'
  ];

  const acronyms = {};
  acronymsList.forEach(acronym => {
    acronyms[acronym] = true;
  });

  const isAllUpperCase = title === title.toUpperCase();
  const isAllLowerCase = title === title.toLowerCase();

  if (isAllUpperCase || isAllLowerCase) {
    const lowerTitle = title.toLowerCase();
    const words = lowerTitle.split(' ');

    const capitalizedWords = words.map(word => {
      const upperCaseWord = word.toUpperCase();
      if (acronyms[upperCaseWord]) {
        return upperCaseWord;
      }

      if (word.length === 0) return word;
      return word[0].toUpperCase() + word.slice(1);
    });

    return capitalizedWords.join(' ');
  }

  return title;
}

function updateNameCasing(name) {
  if (/,/.test(name)) {
    // If name already contains a comma, just clean up spacing around comma
    name = capitalizeName(name.replace(/,\s*/, ', '));
  } else {
    // If no comma, convert "First Last" to "Last, First" format
    name = capitalizeName(name.replace(/(.*) ([^ ]*)$/, '$2, $1'));
  }
  return name;
}

function cleanGrantTitle(rawTitle) {
  if (!rawTitle) return '';

  // Apply SPARQL-style leading/trailing code stripping then normalize spacing/punctuation
  let title = String(rawTitle)
    // Strip optional leading SEE and repeated agency/id tokens, optional SP0A#####, capture remainder, optional trailing K.xx.x
    .replace(/^(?:SEE\s+)?(?:(?:[ABCKKXYZ][0-9CF]{6})*(?:\s*-)?\s*)*\s*(?:SP0A\d{6})?\s*(.*?)(?:\s+K\.[0-9]{2}\.[0-9]{1,2})?$/i, '$1')
    // Strip specific trailing agency codes, mirroring SPARQL behavior
    .replace(/\s+[ABCKKXYZ]\d+[A-Z]*\d*$/i, '')
    .trim();

  // Normalize whitespace and punctuation spacing
  title = title.replace(/\s+/g, ' ');
  title = title.replace(/:\s*/g, ': ').replace(/;\s*/g, '; ').replace(/—\s*/g, '— ');
  title = title.replace(/^[\s•§\-–—]+/, '').replace(/[\s•§\-–—]+$/, '');

  return title;
}

function getGrantType(fields) {
  const fundingType = getFieldValue(fields, 'funding-type');

  const grantTypeMapping = {
    'Academic Support': GRANT_TYPES.ACADEMIC_SUPPORT,
    'Default': GRANT_TYPES.DEFAULT,
    'Instruction': GRANT_TYPES.INSTRUCTION,
    'Research': GRANT_TYPES.RESEARCH,
    'Public Service / Other': GRANT_TYPES.SERVICE,
    'Scholarships / Fellowships': GRANT_TYPES.SCHOLARSHIP,
    'Student Services': GRANT_TYPES.STUDENT_SERVICE
  };

  if (!fundingType) return null;
  return grantTypeMapping[fundingType] || null;
}

function getGrantStatus(endDate) {
  if (!endDate || !endDate['api:year']) {
    return 'Active'; // Default if no end date
  }

  const currentYear = new Date().getFullYear();
  const endYear = parseInt(endDate['api:year']);

  // If we have more detailed date info, use it
  if (endDate['api:month'] && endDate['api:day']) {
    const endDateObj = new Date(endYear, endDate['api:month'] - 1, endDate['api:day']);
    const currentDate = new Date();
    return endDateObj < currentDate ? 'Completed' : 'Active';
  }

  // Otherwise just compare years
  return endYear < currentYear ? 'Completed' : 'Active';
}

// Create user role relationship
function createUserRole(grantRelationship, relationshipUri, expertUri, grantUri, expertData, fields) {
  const relationshipType = grantRelationship.type || 'user-grant-research';
  // Map relationship types to role abbreviations
  const roleMapping = {
    'user-grant-principal-investigation': { abbrev: 'PI', type: ROLE_TYPES.PI },
    'user-grant-co-principal-investigation': { abbrev: 'CoPI', type: ROLE_TYPES.CO_PI },
    'user-grant-senior-key-personnel': { abbrev: 'Res', type: ROLE_TYPES.RESEARCHER },
    'user-grant-co-primary-investigation': { abbrev: 'CoPI', type: ROLE_TYPES.CO_PI },
    'user-grant-primary-investigation': { abbrev: 'PI', type: ROLE_TYPES.PI },
    'user-grant-program-direction': { abbrev: 'Lead', type: ROLE_TYPES.LEADER },
    'user-grant-project-leadership': { abbrev: 'Lead', type: ROLE_TYPES.LEADER },
    'user-grant-research': { abbrev: 'Res', type: ROLE_TYPES.RESEARCHER }
  };
  const roleInfo = roleMapping[relationshipType] || roleMapping['user-grant-research'];

  // SPARQL behavior: relationship label is constructed from the directory user fields
  // (last-name and optional first-name). Format accordingly and prefix with abbrev.
  const userLast = expertData['last-name'] || '';
  const userFirst = expertData['first-name'] || '';
  const formattedUserName = updateNameCasing((userLast + (userFirst ? (', ' + userFirst) : '')).trim());
  const roleName = `${roleInfo.abbrev}: ${formattedUserName}`;

  const isVisible = grantRelationship["api:is-visible"] === 'true';

  const userRole = {
    "@id": relationshipUri,
    "@type": [ roleInfo.type, ONTOLOGY.GRANT_ROLE ],
    "http://purl.obolibrary.org/obo/RO_0000052": [ { "@id": expertUri } ],
    "http://schema.org/name": [ { "@value": roleName } ],
    "http://schema.library.ucdavis.edu/schema#is-visible": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": isVisible.toString() }
    ],
    [ONTOLOGY.RELATES]: [ { "@id": expertUri }, { "@id": grantUri } ]
  };
  return userRole;
}

function sanitizePart(s) {
  return (s || '').toLowerCase().replace(/[^a-z]/g,'');
}

function generatePersonIdStrict(last, first) {
  return `${sanitizePart(last)}_${sanitizePart(first)}`;
}

function createPersonRecord(personId, formattedName, grantUri) {
  return {
    "@id": `${grantUri}#${personId}`,
    "http://schema.org/name": [{ "@value": formattedName }],
    "http://www.w3.org/2006/vcard/ns#hasName": [
      { "@id": `${grantUri}#vcard_${personId}` }
    ]
  };
}

function createVCardRecord(personId, lastName, firstName, grantUri) {
  return {
    "@id": `${grantUri}#vcard_${personId}`,
    "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": capitalizeName(lastName) }],
    "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": capitalizeName(firstName) }]
  };
}

function createRoleRecord(personId, roleType, roleLabel, formattedName, grantUri) {
  return {
    "@id": `${grantUri}#roleof_${personId}`,
    "@type": [roleType],
    "http://schema.org/name": [
      { "@value": `${roleLabel}: ${formattedName}` }
    ],
    [ONTOLOGY.RELATES]: [
      { "@id": grantUri },
      { "@id": `${grantUri}#${personId}` }
    ]
  };
}

function extractGrantData(grantRelationship, relationshipId, expertId) {
  const grantId = jsonpath.value(grantRelationship, '$["api:related"]["id"]');
  const relationshipUri = `ark:/87287/d7mh2m/${relationshipId}`;
  const expertUri = `http://experts.ucdavis.edu/expert/${expertId}`;

  const records = jsonpath.value(grantRelationship, '$["api:related"]["api:object"]["api:records"]["api:record"]') || [];
  const recordsArray = Array.isArray(records) ? records : [records];

  // Prefer the record with the minimal numeric source-id (mirrors SPARQL's min(?id))
  let record = null;
  try {
    const candidates = recordsArray
      .map(r => ({ r, id: (r && (r['source-id'] ?? r['api:source-id'] ?? r['sourceId'] ?? r['id-at-source'])) }))
      .filter(x => x.id !== undefined && x.id !== null);
    // Normalize numeric-like ids
    candidates.forEach(c => {
      if (typeof c.id === 'string' && /^\d+$/.test(c.id)) c.numId = Number(c.id);
      else if (typeof c.id === 'number') c.numId = c.id;
      else c.numId = null;
    });
    const withNum = candidates.filter(c => c.numId !== null);
    if (withNum.length) {
      const minId = Math.min(...withNum.map(c => c.numId));
      const found = withNum.find(c => c.numId === minId);
      if (found) record = found.r;
    }
  } catch (e) {
    // ignore and fallback
  }
  // Fallback: prefer a record containing c-co-pis, else first record
  if (!record) {
    record = recordsArray.find(r => r && r['api:native'] && r['api:native']['api:field'] && r['api:native']['api:field'].some(f => f.name === 'c-co-pis')) || recordsArray[0];
  }

  if (!record || !record['api:native'] || !record['api:native']['api:field']) {
    return null;
  }

  const fields = record['api:native']['api:field'] || [];

  let grantUri = record['id-at-source'];
  if( !grantUri.includes('ark:/')) grantUri = `ark:/87287/d7mh2m/grant/${grantUri}`;

  return {
    grantId,
    relationshipUri,
    expertUri,
    record,
    fields,
    grantUri,
  };
}

function stripGrantIdentifierFromTitle(title, grantUri) {
  if (!title || !grantUri) return title || '';
  const parts = String(grantUri).split('grant/');
  const ident = parts.length > 1 ? parts[1] : '';
  if (!ident) return title;
  const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Remove occurrences of the identifier only when it is standalone or bounded
  // by non-alphanumeric characters (whitespace or punctuation). This avoids
  // stripping identifiers that are attached directly to other words/text.
  // Pattern: (^|[^A-Za-z0-9])IDENT(?=[^A-Za-z0-9]|$) -- keep the prefix capture.
  const re = new RegExp('(^|[^A-Za-z0-9])' + escaped + '(?=[^A-Za-z0-9]|$)', 'g');
  let out = title.replace(re, '$1');

  // Collapse multiple spaces and tidy
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}

function createMainGrantRecord(fields, grantUri, grantId, relationshipUri) {
  const rawTitleVal = getFieldValue(fields, 'title');
  const rawTitle = Array.isArray(rawTitleVal) ? rawTitleVal[0] : rawTitleVal;
  let title = cleanGrantTitle(rawTitle);

  // Strip the grant identifier (from id-at-source / grant URI) if it appears in the title
  title = stripGrantIdentifierFromTitle(title, grantUri);

  // If cleaning removed the title entirely, attempt fallbacks.
  if (!title || title.trim() === '') {
    // Try to pull a short code from the raw title when available (e.g. "SEE X236881")
    if (typeof rawTitle === 'string') {
      const seen = rawTitle.match(/^\s*(?:SEE\s+)?([A-Za-z][A-Za-z0-9\-]*)\b\s*$/i);
      if (seen) {
        title = seen[1];
      }
    }

    // If still empty, fall back to funder-reference or id-at-source
    if ((!title || title.trim() === '')) {
      const rawFunderRef = getFieldValue(fields, 'funder-reference') || '';
      if (rawFunderRef) {
        title = String(rawFunderRef).trim();
      } else if (grantUri) {
        const parts = String(grantUri).split('grant/');
        const ident = parts.length > 1 ? parts[1] : '';
        if (ident) title = ident;
      }
    }
  }

  // Replicate SPARQL OPTIONAL grouping: only treat funder-name and
  // funder-reference as present if both are present on the same record.
  const rawFunderName = getFieldValue(fields, 'funder-name');
  const rawFunderRef = getFieldValue(fields, 'funder-reference');
  let funderName = '';
  let funderReference = '';
  if (rawFunderName && rawFunderRef) {
    funderName = capitalizeTitle(rawFunderName);
    funderReference = rawFunderRef;
  }
  const amount = getFieldObject(fields, 'amount');
  const startDate = getFieldObject(fields, 'start-date');
  const endDate = getFieldObject(fields, 'end-date');

  const startDateValue = formatDate(startDate);
  const endDateValue = formatDate(endDate);
  const grantStatus = getGrantStatus(endDate);

  const piTextValue = getFieldValue(fields, 'c-pi');
  const formattedPiName = piTextValue ? updateNameCasing(piTextValue) : '';

  // Build a compact date range (years only) when available
  const startYear = startDate && startDate['api:year'] ? String(startDate['api:year']) : '';
  const endYear = endDate && endDate['api:year'] ? String(endDate['api:year']) : '';
  let dateRange = '';
  if (startYear && endYear) dateRange = `${startYear} - ${endYear}`;
  else if (startYear) dateRange = startYear;
  else if (endYear) dateRange = endYear;

  // Build status subpart (status plus optional date range and PI)
  const statusParts = [];
  if (grantStatus) statusParts.push(grantStatus);
  if (dateRange) statusParts.push(dateRange);
  if (formattedPiName) statusParts.push(formattedPiName);
  const statusPart = statusParts.length ? statusParts.join(' • ') : '';

  // Compose name pieces: title, statusPart, funderName, funderReference
  const mainPieces = [];
  if (title) mainPieces.push(title);
  if (statusPart) mainPieces.push(statusPart);

  // Build combined funder piece: funderName optionally followed by ' • ' + funderReference
  let funderPiece = '';
  if (funderName && funderReference) funderPiece = `${funderName} • ${funderReference}`;
  else if (funderName) funderPiece = funderName;
  else if (funderReference) funderPiece = funderReference;

  if (funderPiece) mainPieces.push(funderPiece);

  const grantName = mainPieces.join(' § ');

  const specificGrantType = getGrantType(fields);
  const grantTypes = [ONTOLOGY.GRANT];
  if (specificGrantType) grantTypes.unshift(specificGrantType);

  const grant = {
    "@id": grantUri,
    "@type": grantTypes,
    "http://citationstyles.org/schema/status": [{ "@value": grantStatus }],
    "http://schema.org/identifier": [
      { "@id": `ark:/87287/d7mh2m/${grantId}` },
      { "@id": grantUri }
    ],
    [ONTOLOGY.RELATED_BY]: [{ "@id": relationshipUri }]
  };

  // Only include a human-readable name if we actually built one from record fields
  if (grantName) {
    grant["http://schema.org/name"] = [{ "@value": grantName }];
  }

  if (amount) {
    grant[ONTOLOGY.TOTAL_AWARD_AMOUNT] = [{ "@value": amount['$t'] }];
  }

  // Only include sponsorAwardId when the selected record actually has a funderReference
  if (funderReference) {
    grant[ONTOLOGY.SPONSOR_AWARD_ID] = [{ "@value": funderReference }];
  }

  return { grant, startDateValue, endDateValue, funderName, piTextValue, formattedPiName };
}

function createDateRecords(startDateValue, endDateValue, grantUri) {
  const records = [];

  if (!startDateValue && !endDateValue) return records;

  const interval = { "@id": `${grantUri}#interval` };

  if (startDateValue) {
    interval[ONTOLOGY.START] = [{ "@id": `${grantUri}#start_date` }];
    records.push({
      "@id": `${grantUri}#start_date`,
      [ONTOLOGY.DATE_TIME]: [{ "@value": startDateValue }],
      "http://vivoweb.org/ontology/core#dateTimePrecision": [
        { "@id": ONTOLOGY.YEAR_MONTH_DAY_PRECISION }
      ]
    });
  }

  if (endDateValue) {
    interval[ONTOLOGY.END] = [{ "@id": `${grantUri}#end_date` }];
    records.push({
      "@id": `${grantUri}#end_date`,
      [ONTOLOGY.DATE_TIME]: [{ "@value": endDateValue }],
      "http://vivoweb.org/ontology/core#dateTimePrecision": [
        { "@id": ONTOLOGY.YEAR_MONTH_DAY_PRECISION }
      ]
    });
  }

  records.push(interval);
  return { records, intervalId: `${grantUri}#interval` };
}

function createFunderRecord(funderName, grantUri) {
  // Always create a funder node (the SPARQL output included a funder node even when name was empty).
  const node = {
    "@id": `${grantUri}#funder`,
    "@type": [ONTOLOGY.FUNDING_ORG]
  };
  if (funderName) {
    node["http://schema.org/name"] = [{ "@value": funderName }];
  }
  return node;
}

function processAllGrantPeople(fields, grantUri, expertData, piTextValue, formattedPiName) {
  const processedPeople = new Set();
  const createdRoles = [];
  const peopleRecords = [];

  const normalizeLast = s => (s||'').toLowerCase().replace(/[-\s]/g,'');
  const normalizeFirstCore = s => (s||'').toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g,'');
  const stripMiddleInitial = s => (s||'').replace(/\s+[A-Za-z]$/,'');
  const lastNamesEquivalent = (a,b) => {
    if (!a || !b) return false;
    const norm = s => s.toLowerCase().replace(/[^a-z]/g,'');
    return norm(a) === norm(b);
  };

  const expertLast = expertData['last-name'] || '';
  const expertFirst = expertData['first-name'] || '';

  // Determine distinct CoPIs (exclude variants of expert name differing only by middle initial or hyphen extension)
  let distinctCoPIs = [];
  const coPiListFieldProbe = fields.find(f => f.name === 'c-co-pis');
  if (coPiListFieldProbe && coPiListFieldProbe['api:people']) {
    const ap = coPiListFieldProbe['api:people']['api:person'];
    const arr = Array.isArray(ap) ? ap : [ap];
    arr.forEach(p => {
      if (typeof p === 'string') return;
      const l = p['api:last-name'] || p['api:last-name'] || ''; // last name (fallback identical kept for clarity)
      const f = p['api:first-names'] || p['api:first-name'] || ''; // support singular first-name
      if (!l || !f) return;
      const coreMatch = lastNamesEquivalent(l, expertLast) && normalizeFirstCore(f) === normalizeFirstCore(expertFirst);
      const middleStripMatch = lastNamesEquivalent(l, expertLast) && normalizeFirstCore(stripMiddleInitial(f)) === normalizeFirstCore(expertFirst);
      const matchesExpert = coreMatch || middleStripMatch;
      if (!matchesExpert) distinctCoPIs.push(p);
    });
  }
  const hasDistinctCoPIs = distinctCoPIs.length > 0;

  // Capture expert variants that add a trailing middle initial token (e.g. "Maja M" / "Nicole T") so we can emit person/vcard without a CoPI role.
  let expertExtraVariants = [];
  let expertBaseCoPiPresent = false; // track if expert appears as a co-pi exact/base (without extra middle initial variant)
  if (coPiListFieldProbe && coPiListFieldProbe['api:people']) {
    const ap = coPiListFieldProbe['api:people']['api:person'];
    const arr = Array.isArray(ap) ? ap : [ap];
    arr.forEach(p => {
      if (typeof p === 'string') return;
      const l = p['api:last-name'] || p['api:last-name'] || '';
      const f = p['api:first-names'] || p['api:first-name'] || '';
      if (!l || !f) return;
      const coreMatch = lastNamesEquivalent(l, expertLast) && normalizeFirstCore(f) === normalizeFirstCore(expertFirst);
      const hasExtraTrailingInitial = /\s+[A-Za-z]$/.test(f);
      if (coreMatch) {
        if (hasExtraTrailingInitial) {
          expertExtraVariants.push(p);
        } else {
          expertBaseCoPiPresent = true; // expert appears directly in co-pis
        }
      }
    });
  }

  // If expert appears as a co-pi (base form) ensure person & vcard nodes exist (no CoPI role)
  if (expertBaseCoPiPresent) {
    const formattedExpertName = updateNameCasing(`${expertLast}, ${expertFirst}`);
    const expertPersonId = generatePersonIdStrict(expertLast, expertFirst);
    const personUriCheck = `${grantUri}#${expertPersonId}`;
    const hasExpertPerson = peopleRecords.some(r => r['@id'] === personUriCheck);
    if (!hasExpertPerson) {
      peopleRecords.push(createPersonRecord(expertPersonId, formattedExpertName, grantUri));
      peopleRecords.push(createVCardRecord(expertPersonId, expertLast, expertFirst, grantUri));
    }
  }

  // PI person + conditional separate PI role
  if (piTextValue) {
    const nameParts = formattedPiName.split(', ');
    if (nameParts.length >= 2) {
      const lastName = nameParts[0];
      const firstName = nameParts[1];
      const piId = generatePersonIdStrict(lastName, firstName);
      const isCurrentExpert = lastNamesEquivalent(lastName, expertLast) && (
        normalizeFirstCore(firstName) === normalizeFirstCore(expertFirst) ||
        normalizeFirstCore(stripMiddleInitial(firstName)) === normalizeFirstCore(expertFirst)
      );

      // Detect hyphenated variant in co-pis when PI last name is canonical (no hyphen)
      const hyphenVariantPresent = !lastName.includes('-') && coPiListFieldProbe && coPiListFieldProbe['api:people'] && (Array.isArray(coPiListFieldProbe['api:people']['api:person']) ? coPiListFieldProbe['api:people']['api:person'] : [coPiListFieldProbe['api:people']['api:person']]).some(p => {
        if (typeof p === 'string') return false;
        const l = (p['api:last-name']||'');
        if (!l.includes('-')) return false;
        return l.split('-')[0].toLowerCase() === expertLast.toLowerCase();
      });
      // SPARQL-aligned suppression treating hyphenated last-name variants as equivalent, but project requirement:
      // If a hyphenated variant exists in co-pis and PI is canonical, still emit separate PI role.
      const strictLastMatch = lastNamesEquivalent(lastName, expertLast); // hyphenated equivalence
      const firstCoreMatch = (
        normalizeFirstCore(firstName) === normalizeFirstCore(expertFirst) ||
        normalizeFirstCore(stripMiddleInitial(firstName)) === normalizeFirstCore(expertFirst)
      );
      const isCurrentExpertStrict = strictLastMatch && firstCoreMatch;
      const emitPiRole = !isCurrentExpertStrict || (isCurrentExpertStrict && hyphenVariantPresent && !lastName.includes('-'));
      if (emitPiRole) {
        const roleRecord = createRoleRecord(piId, ROLE_TYPES.PI, 'PI', formattedPiName, grantUri);
        peopleRecords.push(roleRecord);
        createdRoles.push({ '@id': roleRecord['@id'] });
      }
    }
  }

  // Emit expert middle-initial variant person/vcard (no CoPI role)
  expertExtraVariants.forEach(person => {
    const lastName = capitalizeName(person['api:last-name'] || '');
    const firstName = capitalizeName(person['api:first-names'] || '');
    if (!lastName || !firstName) return;
    const formattedName = updateNameCasing(`${lastName}, ${firstName}`); // retain middle initial token
    const variantId = generatePersonIdStrict(lastName, firstName);
    if (!processedPeople.has(variantId)) {
      processedPeople.add(variantId);
      // Keep full firstName (with middle initial) in display name
      peopleRecords.push(createPersonRecord(variantId, formattedName, grantUri));
      peopleRecords.push(createVCardRecord(variantId, lastName, firstName, grantUri));
    }
  });

  // CoPIs: iterate only distinct (already filtered) and suppress expert variants entirely
  distinctCoPIs.forEach(person => {
    const lastName = person['api:last-name'] || person['api:last-name'] || '';
    const firstName = person['api:first-names'] || person['api:first-name'] || '';
    const initials = person['api:initials'] || '';
    if (!lastName || !firstName) return;
    const formattedName = updateNameCasing(`${lastName}, ${firstName}`);
    const coPiId = generatePersonIdStrict(lastName, firstName);
    if (processedPeople.has('copi_' + coPiId)) return;
    processedPeople.add('copi_' + coPiId);
    if (!processedPeople.has('person_' + coPiId) && !processedPeople.has(coPiId)) {
      processedPeople.add('person_' + coPiId);
      peopleRecords.push(createPersonRecord(coPiId, formattedName, grantUri));
      peopleRecords.push(createVCardRecord(coPiId, lastName, firstName, grantUri));
    }
    const isCurrentExpert = lastNamesEquivalent(lastName, expertLast) && (
      normalizeFirstCore(firstName) === normalizeFirstCore(expertFirst) || normalizeFirstCore(stripMiddleInitial(firstName)) === normalizeFirstCore(expertFirst)
    );
    if (!isCurrentExpert) {
      const roleRecord = createRoleRecord(coPiId, ROLE_TYPES.CO_PI, 'COPI', formattedName, grantUri);
      peopleRecords.push(roleRecord);
      createdRoles.push({ '@id': roleRecord['@id'] });
    }
  });

  // Guarantee PI person & vcard exist even if role suppressed
  if (piTextValue && formattedPiName) {
    const parts = formattedPiName.split(', ');
    if (parts.length >= 2) {
      const piLastCheck = parts[0];
      const piFirstCheck = parts[1];
      const piEnsureId = generatePersonIdStrict(piLastCheck, piFirstCheck);
      const personUri = `${grantUri}#${piEnsureId}`;
      const vcardUri = `${grantUri}#vcard_${piEnsureId}`;
      const hasPerson = peopleRecords.some(r => r['@id'] === personUri);
      if (!hasPerson) {
        peopleRecords.push(createPersonRecord(piEnsureId, formattedPiName, grantUri));
        peopleRecords.push(createVCardRecord(piEnsureId, piLastCheck, piFirstCheck, grantUri));
      }
    }
  }

  return { peopleRecords, createdRoles };
}

function mergeRoles(result) {
  const rolesByPersonId = {};
  const rolesToRemove = [];

  // Group roles by the person they relate to
  result.forEach((item, index) => {
    if (item['@type'] &&
        (item['@type'].includes(ROLE_TYPES.PI) ||
        item['@type'].includes(ROLE_TYPES.CO_PI))) {

      const relates = item['http://vivoweb.org/ontology/core#relates'];
      if (relates && relates.length >= 2) {
        // Find the person ID (the one that contains # but doesn't contain 'roleof_')
        const personId = relates.find(rel =>
          rel['@id'].includes('#') &&
          !rel['@id'].includes('roleof_') &&
          !rel['@id'].endsWith('_date') &&
          !rel['@id'].endsWith('funder') &&
          !rel['@id'].endsWith('interval')
        );

        if (personId) {
          const personIdStr = personId['@id'];

          if (!rolesByPersonId[personIdStr]) {
            rolesByPersonId[personIdStr] = [];
          }

          rolesByPersonId[personIdStr].push({ item, index });
        }
      }
    }
  });

  // Merge roles for people who have multiple roles
  Object.keys(rolesByPersonId).forEach(personId => {
    const roles = rolesByPersonId[personId];

    if (roles.length > 1) {
      // Merge into the first role
      const primaryRole = roles[0].item;
      const mergedTypes = new Set(primaryRole['@type'] || []);
      const mergedNames = [...(primaryRole['http://schema.org/name'] || [])];

      // Add types and names from other roles
      for (let i = 1; i < roles.length; i++) {
        const otherRole = roles[i].item;

        (otherRole['@type'] || []).forEach(type => mergedTypes.add(type));

        (otherRole['http://schema.org/name'] || []).forEach(name => {
          if (!mergedNames.some(existing => existing['@value'] === name['@value'])) {
            mergedNames.push(name);
          }
        });

        rolesToRemove.push(roles[i].index);
      }

      // Update the primary role
      primaryRole['@type'] = Array.from(mergedTypes);
      primaryRole['http://schema.org/name'] = mergedNames;
    }
  });

  // Remove duplicate roles (in reverse order to maintain indices)
  rolesToRemove.sort((a, b) => b - a).forEach(index => {
    result.splice(index, 1);
  });

  return result;
}

function finalizeGrantOutput(grant, result, createdRoles, userRole, relationshipUri, grantUri) {
  if (createdRoles.length > 0) {
    grant[ONTOLOGY.RELATED_BY].push(...createdRoles);
  }

  result.push(grant);
  result.push(userRole);

  result = mergeRoles(result);

  const uniqueCreatedRoles = [];
  const seenRoleIds = new Set();

  createdRoles.forEach(role => {
    if (!seenRoleIds.has(role['@id'])) {
      seenRoleIds.add(role['@id']);
      uniqueCreatedRoles.push(role);
    }
  });

  const grantIndex = result.findIndex(item => item['@id'] === grantUri);
  if (grantIndex !== -1) {
    result[grantIndex][ONTOLOGY.RELATED_BY] = [
      { "@id": relationshipUri },
      ...uniqueCreatedRoles
    ];
  }

  return result;
}

function transformGrants(grants, expertId, expertData) {
  let results = [];
  grants.forEach(grant => {
    // if( grant.id == '6184542' ) console.log('about to parse 6184542', JSON.stringify(grant));
    let relationshipId = grant.id;
    results.push({ relationshipId, graph: transformGrant(grant, relationshipId, expertId, expertData) });
  });
  return results;
}

function transformGrant(grantRelationship, relationshipId, expertId, expertData) {
  // Extract data
  const extractedData = extractGrantData(grantRelationship, relationshipId, expertId);
  if (!extractedData) return [];

  const { grantId, relationshipUri, expertUri, fields, grantUri } = extractedData;

  // Create main grant record
  const { grant, startDateValue, endDateValue, funderName, piTextValue, formattedPiName } =
    createMainGrantRecord(fields, grantUri, grantId, relationshipUri);

  let result = [];

  // Add date records
  const { records: dateRecords, intervalId } = createDateRecords(startDateValue, endDateValue, grantUri);
  if (intervalId) {
    grant[ONTOLOGY.DATE_TIME_INTERVAL] = [{ "@id": intervalId }];
  }
  result.push(...dateRecords);

  // Add funder record
  const funderRecord = createFunderRecord(funderName, grantUri);
  if (funderRecord) {
    grant[ONTOLOGY.ASSIGNED_BY] = [{ "@id": funderRecord["@id"] }];
    result.push(funderRecord);
  }

  // Process people
  const { peopleRecords, createdRoles } = processAllGrantPeople(fields, grantUri, expertData, piTextValue, formattedPiName);
  result.push(...peopleRecords);

  // Create user role (pass fields so we can choose best expert display variant)
  const userRole = createUserRole(grantRelationship, relationshipUri, expertUri, grantUri, expertData, fields);

  // Finalize output
  return finalizeGrantOutput(grant, result, createdRoles, userRole, relationshipUri, grantUri);
}

export { transformGrants };