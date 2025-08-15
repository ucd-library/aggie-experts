import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, getFieldObject } from './utils.js';

function capitalizeName(name) {
  if (!name) return '';

  // Check if the entire string is either all uppercase or all lowercase
  const isAllUpperCase = name === name.toUpperCase();
  const isAllLowerCase = name === name.toLowerCase();

  // Only proceed with capitalization if the string is all upper or lower case
  if (isAllUpperCase || isAllLowerCase) {
    // Split the name into words
    const lowerName = name.toLowerCase();
    const words = lowerName.split(' ');

    // Capitalize each word and handle hyphenated and apostrophized parts
    const capitalizedWords = words.map(word => {
      // Split by hyphen or apostrophe, capitalize each part, and join them back
      const capitalizeParts = (word, delimiter) => {
        return word.split(delimiter).map(part => {
          if (part.length === 0) return part;
          return part[0].toUpperCase() + part.slice(1);
        }).join(delimiter);
      };

      // First handle hyphens
      word = capitalizeParts(word, '-');
      // Then handle apostrophes
      word = capitalizeParts(word, '\'');

      return word;
    });

    // Join the capitalized words back into a single string
    return capitalizedWords.join(' ');
  }

  // Return the original string if it's not all upper or lower case
  return name;
}

function capitalizeTitle(title) {
  if (!title) return '';

  // Canonical list of acronyms from the SPARQL functions
  const acronymsList = [
    "CA", "CDPH", "ACS", "AbbVie", "PHS", "GSK", "NIMH", "FAA", "US", "MRPI",
    "UCRI", "EPA", "UT", "UC","NIH","NCI", "NIAID", "NIDCR", "NIDDK", "NHLBI",
    "NIMH", "NINDS", "NLM", "NICHD", "NIGMS", "NEI", "NIEHS", "NIAAA", "NIA",
    "NIAMS", "NINR", "NIDCD", "NHGRI", "NIBIB", "NIMHD",
    'CDC', 'CIA', 'DARPA', 'DOD', 'DOE', 'EPA', 'ESA', 'EU', 'FBI',
    'IMF', 'JPL', 'NASA', 'NIH', 'NOAA', 'NSERC', 'NSF', 'OECD',
    'OPEC', 'UN', 'UNESCO', 'UNICEF', 'USA', 'USDA', 'WHO', 'WTO'
  ];

  // Create lookup object for fast access
  const acronyms = {};
  acronymsList.forEach(acronym => {
    acronyms[acronym] = true;
  });

  // Check if the entire string is either all uppercase or all lowercase
  const isAllUpperCase = title === title.toUpperCase();
  const isAllLowerCase = title === title.toLowerCase();

  // Only proceed with capitalization if the string is all upper or lower case
  if (isAllUpperCase || isAllLowerCase) {
    // Split the title into words
    const lowerTitle = title.toLowerCase();
    const words = lowerTitle.split(' ');

    // Capitalize each word
    const capitalizedWords = words.map(word => {
      const upperCaseWord = word.toUpperCase();
      if (acronyms[upperCaseWord]) {
        return upperCaseWord;
      }
      
      // Capitalize normally
      if (word.length === 0) return word;
      return word[0].toUpperCase() + word.slice(1);
    });

    return capitalizedWords.join(' ');
  }

  // Return the original string if it's not all upper or lower case
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
    'Academic Support': 'http://schema.library.ucdavis.edu/schema#Grant_AcademicSupport',
    'Default': 'http://schema.library.ucdavis.edu/schema#Grant_Default',
    'Instruction': 'http://schema.library.ucdavis.edu/schema#Grant_Instruction',
    'Research': 'http://schema.library.ucdavis.edu/schema#Grant_Research',
    'Public Service / Other': 'http://schema.library.ucdavis.edu/schema#Grant_Service',
    'Scholarships / Fellowships': 'http://schema.library.ucdavis.edu/schema#Grant_Scholarship',
    'Student Services': 'http://schema.library.ucdavis.edu/schema#Grant_StudentService'
  };
  
  // Default to Grant_Service if funding type not found or not specified
  return grantTypeMapping[fundingType] || 'http://schema.library.ucdavis.edu/schema#Grant_Service';
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
  // Extract relationship type to determine role abbreviation
  const relationshipType = grantRelationship.type || 'user-grant-research';
  
  // Map relationship types to role abbreviations
  const roleMapping = {
    'user-grant-principal-investigation': { abbrev: 'PI', type: 'http://vivoweb.org/ontology/core#PrincipalInvestigatorRole' },
    'user-grant-co-principal-investigation': { abbrev: 'CoPI', type: 'http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole' },
    'user-grant-senior-key-personnel': { abbrev: 'Res', type: 'http://vivoweb.org/ontology/core#ResearcherRole' },
    'user-grant-co-primary-investigation': { abbrev: 'CoPI', type: 'http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole' },
    'user-grant-primary-investigation': { abbrev: 'PI', type: 'http://vivoweb.org/ontology/core#PrincipalInvestigatorRole' },
    'user-grant-program-direction': { abbrev: 'Lead', type: 'http://vivoweb.org/ontology/core#LeaderRole' },
    'user-grant-project-leadership': { abbrev: 'Lead', type: 'http://vivoweb.org/ontology/core#LeaderRole' },
    'user-grant-research': { abbrev: 'Res', type: 'http://vivoweb.org/ontology/core#ResearcherRole' }
  };
  
  const roleInfo = roleMapping[relationshipType] || roleMapping['user-grant-research'];
  
  let userName = 'Unknown User';
  if (expertData) {
    // Extract user last name and first name from expert data
    const userLastName = expertData['last-name'] || '';
    const userFirstName = expertData['first-name'] || '';
    
    // Construct name: "Last, First" or just "Last" if no first name
    userName = userLastName + (userFirstName ? `, ${userFirstName}` : '');
  }
  
  // Create role name
  const roleName = `${roleInfo.abbrev}: ${userName}`;
  
  // Extract visibility
  const isVisible = grantRelationship["api:is-visible"] === 'true';
  
  const userRole = {
    "@id": relationshipUri,
    "@type": [
      roleInfo.type,
      "http://schema.library.ucdavis.edu/schema#GrantRole"
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
    "http://vivoweb.org/ontology/core#relates": [
      { "@id": expertUri },
      { "@id": grantUri }
    ]
  };

  return userRole;
}

function transformGrants(grants, expertId, expertData) {
  let results = [];
  grants.forEach(grant => {
    let relationshipId = grant.id;
    let isVisible = grant["api:is-visible"] === 'true';
    if (isVisible) {
      results.push({ relationshipId, graph: transformGrant(grant, relationshipId, expertId, expertData) });
    }
  });
  return results;
}

function transformGrant(grantRelationship, relationshipId, expertId, expertData) {
  let result = [];
  const grantId = jsonpath.value(grantRelationship, '$["api:related"]["id"]');
  const relationshipUri = `ark:/87287/d7mh2m/${relationshipId}`;
  const expertUri = `http://experts.ucdavis.edu/${expertId}`;

  // Get grant record data
  const records = jsonpath.value(grantRelationship, '$["api:related"]["api:object"]["api:records"]["api:record"]') || [];
  const recordsArray = Array.isArray(records) ? records : [records];

  // Find the record with the most complete field data (usually the institutional one)
  const record = recordsArray.find(r => 
    r['api:native'] && 
    r['api:native']['api:field'] && 
    r['api:native']['api:field'].some(f => f.name === 'c-co-pis')
  ) || recordsArray[0]; // Fallback to first record if none has c-co-pis
    if (!record || !record['api:native'] || !record['api:native']['api:field']) return result;

  const fields = record['api:native']['api:field'] || [];

  // Extract grant data
  const rawTitle = getFieldValue(fields, 'title');
  const title = cleanGrantTitle(rawTitle);
  const funderName = capitalizeTitle(getFieldValue(fields, 'funder-name'));
  const funderReference = getFieldValue(fields, 'funder-reference');
  const amount = getFieldObject(fields, 'amount');
  const startDate = getFieldObject(fields, 'start-date');
  const endDate = getFieldObject(fields, 'end-date');

  // Create grant ARK identifier
  const grantArk = record['id-at-source'];
  const grantUri = grantArk;

  // Format dates
  const startDateValue = formatDate(startDate);
  const endDateValue = formatDate(endDate);

  // Determine grant status
  const grantStatus = getGrantStatus(endDate);

  // Create grant name
  const piTextValue = getFieldValue(fields, 'c-pi');
  const formattedPiName = piTextValue ? updateNameCasing(piTextValue) : '';

  let piRoleId = null;
  if (piTextValue) {
    // Extract first and last name from the formatted PI name
    const nameParts = formattedPiName.split(', ');
    if (nameParts.length >= 2) {
      const lastName = nameParts[0].toLowerCase();
      const firstName = nameParts[1].toLowerCase().replace(/\s+/g, '');
      const piId = `${lastName}_${firstName}`;
      piRoleId = `${grantUri}#roleof_${piId}`;
    }
  }

  const grantName = `${title} § ${grantStatus} • ${startDate?.['api:year']} - ${endDate?.['api:year']} • ${formattedPiName} § ${funderName} • ${funderReference}`;
  
  // Get the appropriate grant type based on funding type
  const specificGrantType = getGrantType(fields);
  
  // Create main grant record
  const grant = {
    "@id": grantUri,
    "@type": [
      specificGrantType,
      "http://vivoweb.org/ontology/core#Grant"
    ],
    "http://citationstyles.org/schema/status": [{ "@value": grantStatus }],
    "http://schema.org/identifier": [
      { "@id": `ark:/87287/d7mh2m/${grantId}` },
      { "@id": grantUri }
    ],
    "http://schema.org/name": [{ "@value": grantName }],
    "http://vivoweb.org/ontology/core#relatedBy": [
      { "@id": relationshipUri }
    ]
  };

  if (amount) {
    grant["http://vivoweb.org/ontology/core#totalAwardAmount"] = [
      { "@value": amount['$t'] }
    ];
  }

  if (funderReference) {
    grant["http://vivoweb.org/ontology/core#sponsorAwardId"] = [
      { "@value": funderReference }
    ];
  }

  // Add date interval
  if (startDateValue || endDateValue) {
    grant["http://vivoweb.org/ontology/core#dateTimeInterval"] = [
      { "@id": `${grantUri}#interval` }
    ];

    // Create interval record
    const interval = {
      "@id": `${grantUri}#interval`
    };

    if (startDateValue) {
      interval["http://vivoweb.org/ontology/core#start"] = [
        { "@id": `${grantUri}#start_date` }
      ];

      result.push({
        "@id": `${grantUri}#start_date`,
        "http://vivoweb.org/ontology/core#dateTime": [{ "@value": startDateValue }],
        "http://vivoweb.org/ontology/core#dateTimePrecision": [
          { "@id": "http://vivoweb.org/ontology/core#yearMonthDayPrecision" }
        ]
      });
    }

    if (endDateValue) {
      interval["http://vivoweb.org/ontology/core#end"] = [
        { "@id": `${grantUri}#end_date` }
      ];

      result.push({
        "@id": `${grantUri}#end_date`,
        "http://vivoweb.org/ontology/core#dateTime": [{ "@value": endDateValue }],
        "http://vivoweb.org/ontology/core#dateTimePrecision": [
          { "@id": "http://vivoweb.org/ontology/core#yearMonthDayPrecision" }
        ]
      });
    }

    result.push(interval);
  }

  // Add funder
  if (funderName) {
    grant["http://vivoweb.org/ontology/core#assignedBy"] = [
      { "@id": `${grantUri}#funder` }
    ];

    result.push({
      "@id": `${grantUri}#funder`,
      "@type": ["http://vivoweb.org/ontology/core#FundingOrganization"],
      "http://schema.org/name": [{ "@value": funderName }]
    });
  }

  // Track processed people to avoid duplicates
  const processedPeople = new Set();
  const createdRoles = [];

  // Create PI records if they exist
  if (piTextValue && piRoleId) {
    const nameParts = formattedPiName.split(', ');
    if (nameParts.length >= 2) {
      const lastName = nameParts[0];
      const firstName = nameParts[1];
      const piId = `${lastName.toLowerCase()}_${firstName.toLowerCase().replace(/\s+/g, '').replace(/-/g, '')}`;
      
      // Check if this PI matches the current expert
      const expertLastName = expertData['last-name']?.toLowerCase() || '';
      const expertFirstName = expertData['first-name']?.toLowerCase() || '';
      const personLastName = lastName.toLowerCase();
      const personFirstName = firstName.toLowerCase();
      
      const isCurrentExpert = personLastName === expertLastName && 
          (personFirstName === expertFirstName || 
          personFirstName.startsWith(expertFirstName) || 
          expertFirstName.startsWith(personFirstName));
      
      processedPeople.add(piId);
    
      // Create person record
      result.push({
        "@id": `${grantUri}#${piId}`,
        "http://schema.org/name": [{ "@value": formattedPiName }],
        "http://www.w3.org/2006/vcard/ns#hasName": [
          { "@id": `${grantUri}#vcard_${piId}` }
        ]
      });

      // Create vcard name
      result.push({
        "@id": `${grantUri}#vcard_${piId}`,
        "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": capitalizeName(lastName) }],
        "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": capitalizeName(firstName) }]
      });

      // Only create role if this person is NOT the current expert
      if (!isCurrentExpert) {
        result.push({
          "@id": piRoleId,
          "@type": [
            "http://vivoweb.org/ontology/core#PrincipalInvestigatorRole"
          ],
          "http://schema.org/name": [
            { "@value": `PI: ${formattedPiName}` }
          ],
          "http://vivoweb.org/ontology/core#relates": [
            { "@id": grantUri },
            { "@id": `${grantUri}#${piId}` }
          ]
        });
        createdRoles.push({ "@id": piRoleId }); // Track created role
      }
    }
  }

  // Process c-co-pis field separately  
  const coPiListField = fields.find(f => f.name === 'c-co-pis');
  if (coPiListField && coPiListField['api:people']) {
    const apiPerson = coPiListField['api:people']['api:person'];
    
    // Handle both single object and array cases
    const piPeople = Array.isArray(apiPerson) ? apiPerson : [apiPerson];

    // Get current expert name for comparison
    const expertLastName = expertData['last-name']?.toLowerCase() || '';
    const expertFirstName = expertData['first-name']?.toLowerCase() || '';
    
    piPeople.forEach(person => {
      if (typeof person === 'string') return;

      const lastName = person['api:last-name'] || '';
      const firstName = person['api:first-names'] || '';
      
      if (!lastName || !firstName) return;

      // Check if this person matches the current expert
      const personLastName = lastName.toLowerCase().replace(/,?\s*$/, '');
      const personFirstName = firstName.toLowerCase();

      const isCurrentExpert = personLastName === expertLastName && 
          (personFirstName === expertFirstName || 
           personFirstName.startsWith(expertFirstName) || 
           expertFirstName.startsWith(personFirstName));
      
      const piName = `${lastName.replace(/,?\s*$/, '')}, ${firstName}`;
      const piId = `${lastName.toLowerCase()}_${firstName.toLowerCase().replace(/\s+/g, '').replace(/-/g, '')}`;
      const formattedName = updateNameCasing(piName);

      // Skip if we already processed this person as a Co-PI
      if (processedPeople.has(`copi_${piId}`)) return;
      processedPeople.add(`copi_${piId}`);

      // Create person record if not already created
      if (!processedPeople.has(`person_${piId}`) && !processedPeople.has(piId)) {
        processedPeople.add(`person_${piId}`);
        
        result.push({
          "@id": `${grantUri}#${piId}`,
          "http://schema.org/name": [{ "@value": formattedName }],
          "http://www.w3.org/2006/vcard/ns#hasName": [
            { "@id": `${grantUri}#vcard_${piId}` }
          ]
        });

        result.push({
          "@id": `${grantUri}#vcard_${piId}`,
          "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": capitalizeName(lastName.replace(/,?\s*$/, '')) }],
          "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": capitalizeName(firstName) }]
        });
      }

      // Create Co-PI role for ALL people in c-co-pis (including non-current experts)
      if (!isCurrentExpert) {
        const copiRoleId = `${grantUri}#roleof_${piId}`;
        result.push({
          "@id": copiRoleId,
          "@type": [
            "http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole"
          ],
          "http://schema.org/name": [
            { "@value": `COPI: ${formattedName}` }
          ],
          "http://vivoweb.org/ontology/core#relates": [
            { "@id": grantUri },
            { "@id": `${grantUri}#${piId}` }
          ]
        });
        createdRoles.push({ "@id": copiRoleId });
      }
    });
  }

  // ALSO process c-pi field for additional PIs
  const additionalPiField = fields.find(f => f.name === 'c-pi');
  if (additionalPiField && additionalPiField['api:text']) {
    const piTextValue = additionalPiField['api:text'];
    const formattedPiName = updateNameCasing(piTextValue);
    
    // Parse the name to extract components
    const nameParts = formattedPiName.split(', ');
    if (nameParts.length >= 2) {
      const lastName = nameParts[0];
      const firstName = nameParts[1];
      
      // Get current expert name for comparison
      const expertLastName = expertData['last-name']?.toLowerCase() || '';
      const expertFirstName = expertData['first-name']?.toLowerCase() || '';
      
      // Check if this person matches the current expert
      const personLastName = lastName.toLowerCase();
      const personFirstName = firstName.toLowerCase();

      const isCurrentExpert = personLastName === expertLastName && 
          (personFirstName === expertFirstName || 
           personFirstName.startsWith(expertFirstName) || 
           expertFirstName.startsWith(personFirstName));
      
      const piId = `${lastName.toLowerCase()}_${firstName.toLowerCase().replace(/\s+/g, '').replace(/-/g, '')}`;

      // Only create if this person is NOT the current expert AND we haven't processed them
      if (!isCurrentExpert && !processedPeople.has(piId)) {
        processedPeople.add(piId);

        // Create person record (only if not already created)
        result.push({
          "@id": `${grantUri}#${piId}`,
          "http://schema.org/name": [{ "@value": formattedPiName }],
          "http://www.w3.org/2006/vcard/ns#hasName": [
            { "@id": `${grantUri}#vcard_${piId}` }
          ]
        });

        // Create vcard name
        result.push({
          "@id": `${grantUri}#vcard_${piId}`,
          "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": capitalizeName(lastName) }],
          "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": capitalizeName(firstName) }]
        });

        // Create PI role
        result.push({
          "@id": `${grantUri}#roleof_${piId}`,
          "@type": [
            "http://vivoweb.org/ontology/core#PrincipalInvestigatorRole"
          ],
          "http://schema.org/name": [
            { "@value": `PI: ${formattedPiName}` }
          ],
          "http://vivoweb.org/ontology/core#relates": [
            { "@id": grantUri },
            { "@id": `${grantUri}#${piId}` }
          ]
        });
        createdRoles.push({ "@id": `${grantUri}#roleof_${piId}` });
      }
    }
  }

  // Add created roles to grant's relatedBy array
  if (createdRoles.length > 0) {
    grant["http://vivoweb.org/ontology/core#relatedBy"].push(...createdRoles);
  }

  result.push(grant);

  const userRole = createUserRole(grantRelationship, relationshipUri, expertUri, grantUri, expertData);
  result.push(userRole);
  
  // After processing both PI and Co-PI lists, merge roles for people who appear in both
  function mergeRoles(result) {
    const rolesByPersonId = {};
    const rolesToRemove = [];
    
    // Group roles by the person they relate to
    result.forEach((item, index) => {
      if (item['@type'] && 
          (item['@type'].includes('http://vivoweb.org/ontology/core#PrincipalInvestigatorRole') ||
          item['@type'].includes('http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole'))) {
        
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
          
          // Add types
          (otherRole['@type'] || []).forEach(type => mergedTypes.add(type));
          
          // Add names
          (otherRole['http://schema.org/name'] || []).forEach(name => {
            if (!mergedNames.some(existing => existing['@value'] === name['@value'])) {
              mergedNames.push(name);
            }
          });
          
          // Mark for removal
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

  result = mergeRoles(result);
  
  // Remove duplicates from createdRoles array
  const uniqueCreatedRoles = [];
  const seenRoleIds = new Set();

  createdRoles.forEach(role => {
    if (!seenRoleIds.has(role['@id'])) {
      seenRoleIds.add(role['@id']);
      uniqueCreatedRoles.push(role);
    }
  });

  // Update the grant's relatedBy with deduplicated roles
  const grantIndex = result.findIndex(item => item['@id'] === grantUri);
  if (grantIndex !== -1) {
    result[grantIndex]["http://vivoweb.org/ontology/core#relatedBy"] = [
      { "@id": relationshipUri },
      ...uniqueCreatedRoles
    ];
  }
  
  return result;
}

export { transformGrants };
