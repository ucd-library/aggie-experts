import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, getFieldObject, extractAsArray } from './utils.js';

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

function transformWork(workRelationship, relationshipId, expertId) {
  const result = [];
  const publicationId = workRelationship.id;
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
  const authorsField = fields.find(f => f && f.name === 'authors');
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
