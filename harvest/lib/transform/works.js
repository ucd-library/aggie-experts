import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, getBestFieldValueFromRecords, getFieldObject, extractAsArray } from './utils.js';

function transformWorks(works, expertId) {
  let results = [];
  works.forEach(work => {
    let relationshipId = work.id;
    let isVisible = work["api:is-visible"] === 'true';
    if (isVisible) {
      results.push({ relationshipId, graph: transformWork(work, relationshipId, expertId) });
    }
  });
  return results;
}

function getBestAuthorsFromRecords(records) {
  // Priority order matching your SPARQL query
  const sourceOrder = ['verified-manual', 'repec', 'dimensions', 'pubmed', 'scopus', 'wos', 'wos-lite', 'crossref', 'epmc', 'google-books', 'arxiv', 'orcid', 'dblp', 'cinqii-english', 'figshare', 'cinii-japanese', 'manual', 'dspace'];

  for (const sourceName of sourceOrder) {
    const record = records.find(r => r['source-name'] === sourceName);
    if (record && record['api:native'] && record['api:native']['api:field']) {
      const authorsField = record['api:native']['api:field'].find(f => f && f.name === 'authors');
      if (authorsField && authorsField['api:people'] && authorsField['api:people']['api:person']) {
        return authorsField;
      }
    }
  }

  return null;
}

function formatOnlinePublicationDate(fields, fieldName = 'online-publication-date') {
  const dateField = fields.find(f => f && f.name === fieldName);
  if (!dateField || !dateField['api:date']) return null;

  return formatDate(dateField);
}

// function getBestFieldFromRecords(fieldName, records) {
//   // Priority order matching your SPARQL query
//   const sourceOrder = ['verified-manual', 'repec', 'dimensions', 'pubmed', 'scopus', 'wos', 'wos-lite', 'crossref', 'epmc', 'google-books', 'arxiv', 'orcid', 'dblp', 'cinqii-english', 'figshare', 'cinii-japanese', 'manual', 'dspace'];

//   console.log(`\n=== Looking for field: ${fieldName} ===`);
//   console.log('Available records:', records.map(r => r['source-name']));

//   for (const sourceName of sourceOrder) {
//     const record = records.find(r => r['source-name'] === sourceName);
//     if (record) {
//       console.log(`Checking source: ${sourceName}`);
//       if (record['api:native'] && record['api:native']['api:field']) {
//         const fieldNames = record['api:native']['api:field'].map(f => f.name);
//         console.log(`  Available fields in ${sourceName}:`, fieldNames);

//         const field = record['api:native']['api:field'].find(f => f && f.name === fieldName);
//         if (field) {
//           console.log(`  ✅ Found ${fieldName} in ${sourceName}:`, field);
//           return field;
//         } else {
//           console.log(`  ❌ No ${fieldName} in ${sourceName}`);
//         }
//       } else {
//         console.log(`  ❌ No api:native/api:field in ${sourceName}`);
//       }
//     }
//   }

//   console.log(`❌ Field ${fieldName} not found in any record`);
//   return null;
// }

function transformWork(workRelationship, relationshipId, expertId) {
  const result = [];

  const publicationId = jsonpath.value(workRelationship, '$["api:related"]["id"]');
  const publicationUri = `ark:/87287/d7mh2m/publication/${publicationId}`;
  const relationshipUri = `ark:/87287/d7mh2m/relationship/${relationshipId}`;
  const expertUri = `http://experts.ucdavis.edu/${expertId}`;

  // Get the best record data (prefer manual > dimensions > crossref > others)
  const records = extractAsArray(workRelationship, '$["api:related"]["api:object"]["api:records"]["api:record"]');
  let primaryRecord = records.find(r => r['source-name'] === 'manual') ||
                     records.find(r => r['source-name'] === 'dimensions') ||
                     records.find(r => r['source-name'] === 'crossref') ||
                     records[0];

  if (!primaryRecord || !primaryRecord['api:native'] || !primaryRecord['api:native']['api:field']) return result;

  const fields = primaryRecord['api:native']['api:field'] || [];

  // Extract publication data using jsonpath
  const title = getFieldValue(fields, 'title');
  const abstract = getBestFieldValueFromRecords('abstract', records);
  const doi = getFieldValue(fields, 'doi');
  const issn = getBestFieldValueFromRecords('issn', records);
  const eissn = getBestFieldValueFromRecords('eissn', records);
  const journal = getFieldValue(fields, 'journal');
  const publisher = getBestFieldValueFromRecords('publisher', records);
  const volume = getFieldValue(fields, 'volume');
  const issue = getFieldValue(fields, 'issue');
  const language = getFieldValue(fields, 'language') || 'en';
  const medium = getFieldValue(fields, 'medium') || 'Undetermined';


  // TODO fix, pulling null values..
  // Instead of using the primary record's fields
  // const onlinePublicationDateField = getBestFieldFromRecords('online-publication-date', records);
  // const dateAvailable = onlinePublicationDateField ? formatDate(onlinePublicationDateField) : null;
  // console.log(dateAvailable);


    // Debug which record is being used
  // console.log('Primary record source:', primaryRecord['source-name']);
  // console.log('Available fields:', primaryRecord['api:native']['api:field'].map(f => f.name));

  // // Try the source-specific approach
  // const onlinePubDateField = getBestFieldFromRecords('online-publication-date', records);
  // console.log('Best online-publication-date field:', onlinePubDateField);

  // const dateAvailable = onlinePubDateField ? formatDate(onlinePubDateField) : null;
  // console.log('Formatted date available:', dateAvailable);
  let dateAvailable = '';


  const status = getFieldValue(fields, 'publication-status') || 'Published';
  const url = getBestFieldValueFromRecords('public-url', records);

  // Extract pagination
  const pagination = getFieldObject(fields, 'pagination');
  const pages = pagination ? `${pagination['api:begin-page']}-${pagination['api:end-page']}` : null;

  // Extract publication date
  const publicationDate = getFieldObject(fields, 'publication-date');
  const dateValue = formatDate(publicationDate);

  // Extract authors
  // const authorsField = fields.find(f => f && f.name === 'authors');
  // const authors = authorsField ? extractAsArray(authorsField, '$["api:people"]["api:person"]') : [];
  // Extract authors - use best source for author data
  const authorsField = getBestAuthorsFromRecords(records);
  const authors = authorsField ? extractAsArray(authorsField, '$["api:people"]["api:person"]') : [];

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
  if (issue) publication["http://citationstyles.org/schema/issue"] = [{ "@value": issue }];
  if (language) publication["http://citationstyles.org/schema/language"] = [{ "@value": language }];
  if (medium) publication["http://citationstyles.org/schema/medium"] = [{ "@value": medium }];
  if (dateAvailable) publication["http://citationstyles.org/schema/date-available"] = [{ "@value": dateAvailable }];
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
    const firstName = jsonpath.value(author, '$["api:first-names"]');
                                            // || jsonpath.value(author, '$["api:initials"]');

    result.push({
      "@id": authorUri,
      "http://citationstyles.org/schema/family": [{ "@value": lastName }],
      "http://citationstyles.org/schema/given": [{ "@value": firstName }],
      "http://vivoweb.org/ontology/core#rank": [
        { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": `${rank}` }
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
    "http://vivoweb.org/ontology/core#rank": [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": "1" }
    ],
    "http://vivoweb.org/ontology/core#relates": [
      { "@id": publicationUri },
      { "@id": expertUri }
    ]
  };

  // Find author rank for this user in the publication
  const userAuthor = authors.find(author =>
    jsonpath.value(author, '$["api:links"]["api:link"].id') === expertId
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

export { transformWorks };
