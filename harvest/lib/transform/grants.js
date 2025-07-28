import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, getFieldObject } from './utils.js';

function transformGrants(grants, expertId) {
  let results = [];
  grants.forEach(grant => {
    let relationshipId = grant.id;
    let isVisible = grant["api:is-visible"] === 'true';
    if (isVisible) {
      results.push({ relationshipId, graph: transformGrant(grant, relationshipId, expertId) });
    }
  });
  return results;
}

function transformGrant(grantRelationship, relationshipId, expertId) {
  const result = [];
  const grantId = grantRelationship.id;
  const relationshipUri = `ark:/87287/d7mh2m/${relationshipId}`;
  const expertUri = `http://experts.ucdavis.edu/${expertId}`;

  // Get grant record data
  const record = jsonpath.value(grantRelationship, '$["api:related"]["api:object"]["api:records"]["api:record"]');
  if (!record || !record['api:native'] || !record['api:native']['api:field']) return result;

  const fields = record['api:native']['api:field'] || [];

  // Extract grant data
  const title = getFieldValue(fields, 'title');
  const funderName = getFieldValue(fields, 'funder-name');
  const funderReference = getFieldValue(fields, 'funder-reference');
  const amount = getFieldObject(fields, 'amount');
  const startDate = getFieldObject(fields, 'start-date');
  const endDate = getFieldObject(fields, 'end-date');
  const piField = fields.find(f => f.name === 'c-co-pis' || f.name === 'c-pi');

  // Create grant ARK identifier
  const grantArk = record['id-at-source'];
  const grantUri = grantArk;

  // Format dates
  const startDateValue = formatDate(startDate);
  const endDateValue = formatDate(endDate);

  // Create grant name
  const grantName = `${title} § Completed • ${startDate?.['api:year']} - ${endDate?.['api:year']} • ${getFieldValue(fields, 'c-pi')} § ${funderName} • ${funderReference}`;

  // Create main grant record
  const grant = {
    "@id": grantUri,
    "@type": [
      "http://schema.library.ucdavis.edu/schema#Grant_Service",
      "http://vivoweb.org/ontology/core#Grant"
    ],
    "http://citationstyles.org/schema/status": [{ "@value": "Completed" }],
    "http://schema.org/identifier": [
      { "@id": `ark:/87287/d7mh2m/${grantId}` },
      { "@id": grantUri }
    ],
    "http://schema.org/name": [{ "@value": grantName }],
    "http://vivoweb.org/ontology/core#relatedBy": [
      { "@id": `${grantUri}#roleof_ustin_susanl` },
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

  result.push(grant);

  // Create PI records if they exist
  if (piField && piField['api:people']) {
    const piPeople = jsonpath.query(piField, '$["api:people"]["api:person"][*]');
    piPeople.forEach(person => {
      if( typeof person === 'string' ) {
        result.push({
          "@id": `${grantUri}#${person}`,
          "@type": "http://vivoweb.org/ontology/core#Person",
          "http://schema.org/name": [{ "@value": person }]
        });
        return;
      }

      const lastName = jsonpath.value(person, '$["api:last-name"]') || '';
      const firstName = jsonpath.value(person, '$["api:first-names"]') || '';
      const piName = `${lastName.replace(/,?\s*$/, '')}, ${firstName}`;
      const piId = `${lastName.toLowerCase()}_${firstName.toLowerCase().replace(/\s+/g, '')}`;

      // Create person record
      result.push({
        "@id": `${grantUri}#${piId}`,
        "http://schema.org/name": [{ "@value": piName }],
        "http://www.w3.org/2006/vcard/ns#hasName": [
          { "@id": `${grantUri}#vcard_${piId}` }
        ]
      });

      // Create vcard name
      result.push({
        "@id": `${grantUri}#vcard_${piId}`,
        "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": lastName.replace(/,?\s*$/, '') }],
        "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": firstName }]
      });

      // Create PI role
      result.push({
        "@id": `${grantUri}#roleof_${piId}`,
        "@type": [
          "http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole",
          "http://vivoweb.org/ontology/core#PrincipalInvestigatorRole"
        ],
        "http://schema.org/name": [
          { "@value": `COPI: ${piName}` },
          { "@value": `PI: ${piName}` }
        ],
        "http://vivoweb.org/ontology/core#relates": [
          { "@id": grantUri },
          { "@id": `${grantUri}#${piId}` }
        ]
      });
    });
  }

  // Create user role relationship
  const userRole = {
    "@id": relationshipUri,
    "@type": [
      "http://vivoweb.org/ontology/core#ResearcherRole",
      "http://schema.library.ucdavis.edu/schema#GrantRole"
    ],
    "http://purl.obolibrary.org/obo/RO_0000052": [
      { "@id": expertUri }
    ],
    "http://schema.org/name": [
      { "@value": "Res: Merz, Justin" }
    ],
    "http://schema.library.ucdavis.edu/schema#is-visible": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": "true" }
    ],
    "http://vivoweb.org/ontology/core#relates": [
      { "@id": expertUri },
      { "@id": grantUri }
    ]
  };

  result.push(userRole);

  return result;
}

export { transformGrants };
