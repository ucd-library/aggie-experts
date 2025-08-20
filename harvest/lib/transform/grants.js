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

  return rawTitle
    .replace(/^(?:SEE\s+)?(?:(?:[ABCKKXYZ][0-9CF]{6})*(?:\s*-)?\s*)*\s*(?:SP0A\d{6})?\s*(.*?)(?:\s+K.[0-9]{2}\.[0-9]{1,2})?$/i, '$1')
    .replace(/\s+[ABCKKXYZ]\d+[A-Z]*\d*$/i, '') // Remove trailing grant codes like K322D09
    .trim();
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

  // Default to Grant_Service if funding type not found or not specified
  return grantTypeMapping[fundingType] || GRANT_TYPES.SERVICE;
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
function createUserRole(grantRelationship, relationshipUri, expertUri, grantUri, expertData) {
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

  let userName = 'Unknown User';
  if (expertData) {
    const userLastName = expertData['last-name'] || '';
    const userFirstName = expertData['first-name'] || '';

    userName = userLastName + (userFirstName ? `, ${userFirstName}` : '');
  }

  const roleName = `${roleInfo.abbrev}: ${userName}`;

  const isVisible = grantRelationship["api:is-visible"] === 'true';

  const userRole = {
    "@id": relationshipUri,
    "@type": [
      roleInfo.type,
      ONTOLOGY.GRANT_ROLE
    ],
    "http://purl.obolibrary.org/obo/RO_0000052": [
      { "@id": expertUri }
    ],
    "http://schema.org/name": [
      { "@value": roleName }
    ],
    "http://schema.library.ucdavis.edu/schema#is-visible": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": isVisible.toString() }
    ],
    [ONTOLOGY.RELATES]: [
      { "@id": expertUri },
      { "@id": grantUri }
    ]
  };

  return userRole;
}

function generatePersonId(lastName, firstName) {
  return `${lastName.toLowerCase()}_${firstName.toLowerCase().replace(/\s+/g, '').replace(/-/g, '')}`;
}

function isExpertMatch(personLastName, personFirstName, expertData) {
  const expertLastName = expertData['last-name']?.toLowerCase() || '';
  const expertFirstName = expertData['first-name']?.toLowerCase() || '';

  return personLastName === expertLastName &&
    (personFirstName === expertFirstName ||
     personFirstName.startsWith(expertFirstName) ||
     expertFirstName.startsWith(personFirstName));
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
  const expertUri = `http://experts.ucdavis.edu/${expertId}`;

  const records = jsonpath.value(grantRelationship, '$["api:related"]["api:object"]["api:records"]["api:record"]') || [];
  const recordsArray = Array.isArray(records) ? records : [records];

  const record = recordsArray.find(r =>
    r['api:native'] &&
    r['api:native']['api:field'] &&
    r['api:native']['api:field'].some(f => f.name === 'c-co-pis')
  ) || recordsArray[0];

  if (!record || !record['api:native'] || !record['api:native']['api:field']) {
    return null;
  }

  const fields = record['api:native']['api:field'] || [];

  return {
    grantId,
    relationshipUri,
    expertUri,
    record,
    fields,
    grantUri: record['id-at-source']
  };
}

function createMainGrantRecord(fields, grantUri, grantId, relationshipUri) {
  const rawTitle = getFieldValue(fields, 'title');
  const title = cleanGrantTitle(rawTitle);
  const funderName = capitalizeTitle(getFieldValue(fields, 'funder-name'));
  const funderReference = getFieldValue(fields, 'funder-reference');
  const amount = getFieldObject(fields, 'amount');
  const startDate = getFieldObject(fields, 'start-date');
  const endDate = getFieldObject(fields, 'end-date');

  const startDateValue = formatDate(startDate);
  const endDateValue = formatDate(endDate);
  const grantStatus = getGrantStatus(endDate);

  const piTextValue = getFieldValue(fields, 'c-pi');
  const formattedPiName = piTextValue ? updateNameCasing(piTextValue) : '';

  const grantName = `${title} § ${grantStatus} • ${startDate?.['api:year']} - ${endDate?.['api:year']} • ${formattedPiName} § ${funderName} • ${funderReference}`;
  const specificGrantType = getGrantType(fields);

  const grant = {
    "@id": grantUri,
    "@type": [specificGrantType, ONTOLOGY.GRANT],
    "http://citationstyles.org/schema/status": [{ "@value": grantStatus }],
    "http://schema.org/identifier": [
      { "@id": `ark:/87287/d7mh2m/${grantId}` },
      { "@id": grantUri }
    ],
    "http://schema.org/name": [{ "@value": grantName }],
    [ONTOLOGY.RELATED_BY]: [{ "@id": relationshipUri }]
  };

  if (amount) {
    grant[ONTOLOGY.TOTAL_AWARD_AMOUNT] = [{ "@value": amount['$t'] }];
  }

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
  if (!funderName) return null;

  return {
    "@id": `${grantUri}#funder`,
    "@type": [ONTOLOGY.FUNDING_ORG],
    "http://schema.org/name": [{ "@value": funderName }]
  };
}

function processAllGrantPeople(fields, grantUri, expertData, piTextValue, formattedPiName) {
  const processedPeople = new Set();
  const createdRoles = [];
  const peopleRecords = [];

  // Calculate piRoleId for PI processing
  let piRoleId = null;
  if (piTextValue) {
    const nameParts = formattedPiName.split(', ');
    if (nameParts.length >= 2) {
      const piId = generatePersonId(nameParts[0], nameParts[1]);
      piRoleId = `${grantUri}#roleof_${piId}`;
    }
  }

  // Create PI records if they exist
  if (piTextValue && piRoleId) {
    const nameParts = formattedPiName.split(', ');
    if (nameParts.length >= 2) {
      const lastName = nameParts[0];
      const firstName = nameParts[1];
      const piId = generatePersonId(lastName, firstName);

      const personLastName = lastName.toLowerCase();
      const personFirstName = firstName.toLowerCase();

      const isCurrentExpert = isExpertMatch(personLastName, personFirstName, expertData);

      processedPeople.add(piId);

      peopleRecords.push(createPersonRecord(piId, formattedPiName, grantUri));
      peopleRecords.push(createVCardRecord(piId, lastName, firstName, grantUri));

      if (!isCurrentExpert) {
        const roleRecord = createRoleRecord(piId, ROLE_TYPES.PI, 'PI', formattedPiName, grantUri);
        peopleRecords.push(roleRecord);
        createdRoles.push({ "@id": roleRecord["@id"] });
      }
    }
  }

  // Process c-co-pis field
  const coPiListField = fields.find(f => f.name === 'c-co-pis');
  if (coPiListField && coPiListField['api:people']) {
    const apiPerson = coPiListField['api:people']['api:person'];
    const piPeople = Array.isArray(apiPerson) ? apiPerson : [apiPerson];

    piPeople.forEach(person => {
      if (typeof person === 'string') return;

      const lastName = person['api:last-name'] || '';
      const firstName = person['api:first-names'] || '';

      if (!lastName || !firstName) return;

      const personLastName = lastName.toLowerCase().replace(/,?\s*$/, '');
      const personFirstName = firstName.toLowerCase();

      const isCurrentExpert = isExpertMatch(personLastName, personFirstName, expertData);

      const piName = `${lastName.replace(/,?\s*$/, '')}, ${firstName}`;
      const piId = generatePersonId(lastName, firstName);
      const formattedName = updateNameCasing(piName);

      if (processedPeople.has(`copi_${piId}`)) return;
      processedPeople.add(`copi_${piId}`);

      if (!processedPeople.has(`person_${piId}`) && !processedPeople.has(piId)) {
        processedPeople.add(`person_${piId}`);

        peopleRecords.push(createPersonRecord(piId, formattedName, grantUri));
        peopleRecords.push(createVCardRecord(piId, lastName.replace(/,?\s*$/, ''), firstName, grantUri));
      }

      if (!isCurrentExpert) {
        const roleRecord = createRoleRecord(piId, ROLE_TYPES.CO_PI, 'COPI', formattedName, grantUri);
        peopleRecords.push(roleRecord);
        createdRoles.push({ "@id": roleRecord["@id"] });
      }
    });
  }

  // Process c-pi field for additional PIs
  const additionalPiField = fields.find(f => f.name === 'c-pi');
  if (additionalPiField && additionalPiField['api:text']) {
    const piTextValue = additionalPiField['api:text'];
    const formattedPiName = updateNameCasing(piTextValue);

    const nameParts = formattedPiName.split(', ');
    if (nameParts.length >= 2) {
      const lastName = nameParts[0];
      const firstName = nameParts[1];

      const personLastName = lastName.toLowerCase();
      const personFirstName = firstName.toLowerCase();

      const isCurrentExpert = isExpertMatch(personLastName, personFirstName, expertData);

      const piId = generatePersonId(lastName, firstName);

      if (!isCurrentExpert && !processedPeople.has(piId)) {
        processedPeople.add(piId);

        peopleRecords.push(createPersonRecord(piId, formattedPiName, grantUri));
        peopleRecords.push(createVCardRecord(piId, lastName, firstName, grantUri));

        const roleRecord = createRoleRecord(piId, ROLE_TYPES.PI, 'PI', formattedPiName, grantUri);
        peopleRecords.push(roleRecord);
        createdRoles.push({ "@id": roleRecord["@id"] });
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

  // Create user role
  const userRole = createUserRole(grantRelationship, relationshipUri, expertUri, grantUri, expertData);

  // Finalize output
  return finalizeGrantOutput(grant, result, createdRoles, userRole, relationshipUri, grantUri);
}

export { transformGrants };
