import jsonpath from 'jsonpath';
import fs from 'fs';
import path from 'path';

function run(relationshipsData) {
  const result = [];
  
  // Extract all relationships from the graph
  const relationships = jsonpath.query(relationshipsData, '$["@graph"][*]');
  
  relationships.forEach(relationship => {
    const relationshipId = relationship.id;
    const relationType = relationship.type;
    const isVisible = jsonpath.value(relationship, '$["api:is-visible"]') === 'true';
    
    if (relationType === 'publication-user-authorship') {
      // Handle publication relationships
      const publicationData = jsonpath.value(relationship, '$["api:related"][?(@.category=="publication")]["api:object"]');
      const userId = jsonpath.value(relationship, '$["api:related"][?(@.category=="user")].id');
      
      if (publicationData && isVisible) {
        const transformedPublication = transformPublication(publicationData, relationshipId, userId);
        result.push(...transformedPublication);
      }
    } else if (relationType === 'user-grant-research') {
      // Handle grant relationships  
      const grantData = jsonpath.value(relationship, '$["api:related"][?(@.category=="grant")]["api:object"]');
      const userId = jsonpath.value(relationship, '$["api:related"][?(@.category=="user")].id');
      
      if (grantData && isVisible) {
        const transformedGrant = transformGrant(grantData, relationshipId, userId);
        result.push(...transformedGrant);
      }
    }
  });
  
  return result;
}

function transformPublication(publicationData, relationshipId, userId) {
  const result = [];
  const publicationId = publicationData.id;
  const publicationUri = `ark:/87287/d7mh2m/publication/${publicationId}`;
  const relationshipUri = `ark:/87287/d7mh2m/relationship/${relationshipId}`;
  const expertUri = `http://experts.ucdavis.edu/expert/DffIr7cE`; // This should be derived from userId mapping
  
  // Get the best record data (prefer manual > dimensions > crossref > others)
  const records = jsonpath.query(publicationData, '$["api:records"]["api:record"][*]');
  let primaryRecord = records.find(r => r['source-name'] === 'manual') ||
                     records.find(r => r['source-name'] === 'dimensions') ||
                     records.find(r => r['source-name'] === 'crossref') ||
                     records[0];
  
  if (!primaryRecord || !primaryRecord['api:native'] || !primaryRecord['api:native']['api:field']) return result;
  
  const fields = primaryRecord['api:native']['api:field'] || [];
  
  // Extract publication data using jsonpath
  const title = getFieldValue(fields, 'title');
  const abstract = getFieldValue(fields, 'abstract');
  const doi = getFieldValue(fields, 'doi');
  const issn = getFieldValue(fields, 'issn');
  const eissn = getFieldValue(fields, 'eissn');
  const journal = getFieldValue(fields, 'journal');
  const publisher = getFieldValue(fields, 'publisher');
  const volume = getFieldValue(fields, 'volume');
  const issue = getFieldValue(fields, 'issue');
  const language = getFieldValue(fields, 'language') || 'en';
  const medium = getFieldValue(fields, 'medium') || 'Undetermined';
  const status = getFieldValue(fields, 'publication-status') || 'Published';
  const url = getFieldValue(fields, 'public-url');
  
  // Extract pagination
  const pagination = getFieldObject(fields, 'pagination');
  const pages = pagination ? `${pagination['api:begin-page']}-${pagination['api:end-page']}` : null;
  
  // Extract publication date
  const publicationDate = getFieldObject(fields, 'publication-date');
  const dateValue = formatDate(publicationDate);
  
  // Extract authors
  const authorsField = fields.find(f => f.name === 'authors');
  const authors = authorsField ? jsonpath.query(authorsField, '$["api:people"]["api:person"][*]') : [];
  
  // Create main publication record
  const publication = {
    "@id": publicationUri,
    "@type": [
      "http://schema.org/ScholarlyArticle",
      "http://schema.library.ucdavis.edu/schema#Work"
    ],
    "http://vivoweb.org/ontology/core#relatedBy": [
      { "@id": relationshipUri }
    ]
  };
  
  // Add optional fields
  if (title) publication["http://citationstyles.org/schema/title"] = [{ "@value": title }];
  if (abstract) publication["http://citationstyles.org/schema/abstract"] = [{ "@value": abstract }];
  if (doi) publication["http://citationstyles.org/schema/DOI"] = [{ "@value": doi }];
  if (issn) publication["http://citationstyles.org/schema/ISSN"] = [{ "@value": issn }];
  if (eissn) publication["http://citationstyles.org/schema/eissn"] = [{ "@value": eissn }];
  if (journal) publication["http://citationstyles.org/schema/container-title"] = [{ "@value": journal }];
  if (publisher) publication["http://citationstyles.org/schema/publisher"] = [{ "@value": publisher }];
  if (volume) publication["http://citationstyles.org/schema/volume"] = [{ "@value": volume }];
  if (pages) publication["http://citationstyles.org/schema/page"] = [{ "@value": pages }];
  if (language) publication["http://citationstyles.org/schema/language"] = [{ "@value": language }];
  if (medium) publication["http://citationstyles.org/schema/medium"] = [{ "@value": medium }];
  if (status) publication["http://citationstyles.org/schema/status"] = [{ "@value": status }];
  if (url) publication["http://citationstyles.org/schema/url"] = [{ "@value": url }];
  if (dateValue) publication["http://citationstyles.org/schema/issued"] = [{ "@value": dateValue }];
  
  publication["http://citationstyles.org/schema/type"] = [{ "@value": "article-journal" }];
  
  // Add journal venue if issn exists
  if (issn) {
    publication["http://vivoweb.org/ontology/core#hasPublicationVenue"] = [
      { "@id": `http://experts.ucdavis.edu/venue/urn:issn:${issn}` }
    ];
    
    // Create journal venue record
    result.push({
      "@id": `http://experts.ucdavis.edu/venue/urn:issn:${issn}`,
      "http://schema.org/name": [{ "@value": journal }],
      "http://vivoweb.org/ontology/core#issn": [{ "@value": issn }]
    });
  }
  
  // Create author records and add to publication
  const authorUris = [];
  authors.forEach((author, index) => {
    const rank = index + 1;
    const authorUri = `${publicationUri}#${rank}`;
    authorUris.push({ "@id": authorUri });
    
    const lastName = jsonpath.value(author, '$["api:last-name"]');
    const firstName = jsonpath.value(author, '$["api:first-names"]') || 
                     jsonpath.value(author, '$["api:initials"]');
    
    result.push({
      "@id": authorUri,
      "http://citationstyles.org/schema/family": [{ "@value": lastName }],
      "http://citationstyles.org/schema/given": [{ "@value": firstName }],
      "http://vivoweb.org/ontology/core#rank": [
        { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": rank }
      ]
    });
  });
  
  if (authorUris.length > 0) {
    publication["http://citationstyles.org/schema/author"] = authorUris;
  }
  
  result.push(publication);
  
  // Create authorship relationship record
  const authorship = {
    "@id": relationshipUri,
    "@type": [
      "http://schema.library.ucdavis.edu/schema#Authorship",
      "http://vivoweb.org/ontology/core#Authorship"
    ],
    "http://schema.library.ucdavis.edu/schema#is-visible": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": "true" }
    ],
    "http://vivoweb.org/ontology/core#relates": [
      { "@id": publicationUri },
      { "@id": expertUri }
    ]
  };
  
  // Find author rank for this user in the publication
  const userAuthor = authors.find(author => 
    jsonpath.value(author, '$["api:links"]["api:link"].id') === userId
  );
  if (userAuthor) {
    const userRank = authors.indexOf(userAuthor) + 1;
    authorship["http://vivoweb.org/ontology/core#rank"] = [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": userRank }
    ];
  }
  
  result.push(authorship);
  
  return result;
}

function transformGrant(grantData, relationshipId, userId) {
  const result = [];
  const grantId = grantData.id;
  const relationshipUri = `ark:/87287/d7mh2m/${relationshipId}`;
  const expertUri = `http://experts.ucdavis.edu/expert/DffIr7cE`; // This should be derived from userId mapping
  
  // Get grant record data
  const record = jsonpath.value(grantData, '$["api:records"]["api:record"]');
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

// Helper functions
function getFieldValue(fields, fieldName) {
  const field = fields.find(f => f.name === fieldName);
  return field?.['api:text'];
}

function getFieldObject(fields, fieldName) {
  const field = fields.find(f => f.name === fieldName);
  return field ? (field['api:pagination'] || field['api:date'] || field['api:money']) : null;
}

function formatDate(dateObj) {
  if (!dateObj) return null;
  
  const year = dateObj['api:year'];
  const month = dateObj['api:month'];
  const day = dateObj['api:day'];
  
  if (year && month && day) {
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  } else if (year && month) {
    return `${year}-${month.toString().padStart(2, '0')}`;
  } else if (year) {
    return year.toString();
  }
  
  return null;
}

function runFromFiles(relFile) {
  const relationshipsData = JSON.parse(fs.readFileSync(relFile, 'utf8'));
  return run(relationshipsData);
}

function saveRelationshipFiles(inputFile, outputDir = './output') {
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const relationships = jsonpath.query(data, '$["@graph"][*]');
  
  relationships.forEach(relationship => {
    const relationshipId = relationship.id;
    const relationType = relationship.type;
    
    let records = [];
    
    if (relationType === 'publication-user-authorship') {
      const publicationData = jsonpath.value(relationship, '$["api:related"][0]["api:object"]');
      if (publicationData) {
        records = transformPublication(publicationData, relationshipId);
      }
    } else if (relationType === 'grant-user-relation') {
      const grantData = jsonpath.value(relationship, '$["api:related"][0]["api:object"]');
      if (grantData) {
        records = transformGrant(grantData, relationshipId, 'DffIr7cE');
      }
    }
    
    if (records.length > 0) {
      const outputFile = path.join(outputDir, `${relationshipId}.jsonld.json`);
      fs.writeFileSync(outputFile, JSON.stringify(records, null, 2));
      console.log(`Saved ${records.length} records to ${outputFile}`);
    }
  });
}

export { run, runFromFiles, saveRelationshipFiles };
