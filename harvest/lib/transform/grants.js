import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, getFieldObject } from './utils.js';

function capitalizeName(name) {
    if (!name) return '';
    const result = name.trim()
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    return result;
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
  
  return rawTitle.replace(/^(?:SEE\s+)?(?:(?:[ABCKKXYZ][0-9CF]{6})*(?:\s*-)?\s*)*\s*(?:SP0A\d{6})?\s*(.*?)(?:\s+K\.[0-9]{2}\.[0-9]{1,2})?$/i, '$1').trim();
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
  const result = [];
  const grantId = jsonpath.value(grantRelationship, '$["api:related"]["id"]');
  const relationshipUri = `ark:/87287/d7mh2m/${relationshipId}`;
  const expertUri = `http://experts.ucdavis.edu/${expertId}`;

  // Get grant record data
  const record = jsonpath.value(grantRelationship, '$["api:related"]["api:object"]["api:records"]["api:record"]');
  if (!record || !record['api:native'] || !record['api:native']['api:field']) return result;

  const fields = record['api:native']['api:field'] || [];

  // Extract grant data
  const rawTitle = getFieldValue(fields, 'title');
  const title = cleanGrantTitle(rawTitle);
  const funderName = getFieldValue(fields, 'funder-name');
  const funderReference = getFieldValue(fields, 'funder-reference');
  const amount = getFieldObject(fields, 'amount');
  const startDate = getFieldObject(fields, 'start-date');
  const endDate = getFieldObject(fields, 'end-date');
  const coPiListField = fields.find(f => f.name === 'c-co-pis' || f.name === 'c-pi');

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

  const grantName = `${title} § ${grantStatus} • ${startDate?.['api:year']} - ${endDate?.['api:year']} • ${formattedPiName} § ${capitalizeName(funderName)} • ${funderReference}`;
  
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
      "http://schema.org/name": [{ "@value": capitalizeName(funderName) }]
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
      const piId = `${lastName.toLowerCase()}_${firstName.toLowerCase().replace(/\s+/g, '')}`;
      
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

  // Create additional PI records from coPiListField if they exist
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
      const piId = `${lastName.toLowerCase()}_${firstName.toLowerCase().replace(/\s+/g, '')}`;
      const formattedName = updateNameCasing(piName);

      // Skip if we already processed this person
      if (processedPeople.has(piId)) return;
      processedPeople.add(piId);

      // Create person record
      result.push({
        "@id": `${grantUri}#${piId}`,
        "http://schema.org/name": [{ "@value": formattedName }],
        "http://www.w3.org/2006/vcard/ns#hasName": [
          { "@id": `${grantUri}#vcard_${piId}` }
        ]
      });

      // Create vcard name
      result.push({
        "@id": `${grantUri}#vcard_${piId}`,
        "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": capitalizeName(lastName.replace(/,?\s*$/, '')) }],
        "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": capitalizeName(firstName) }]
      });

      // Create PI role
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

  // Add created roles to grant's relatedBy array
  if (createdRoles.length > 0) {
    grant["http://vivoweb.org/ontology/core#relatedBy"].push(...createdRoles);
  }

  result.push(grant);

  const userRole = createUserRole(grantRelationship, relationshipUri, expertUri, grantUri, expertData);
  result.push(userRole);
  
  return result;
}

export { transformGrants };
