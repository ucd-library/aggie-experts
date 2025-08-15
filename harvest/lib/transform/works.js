import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, getBestFieldValueFromRecords, getFieldObject, extractAsArray } from './utils.js';

function transformWorks(works, expertId, elementsUserId, inputGraph) {
  let results = [];
  works.forEach(work => {
    let relationshipId = work.id;
    // let isVisible = work["api:is-visible"] === 'true';
    // if (isVisible) {
      results.push({ relationshipId, graph: transformWork(work, relationshipId, expertId, elementsUserId, inputGraph) });
    // }
  });
  return results;
}

function findJournalByIssn(obj, issn) {
  if (obj && typeof obj === 'object') {
    if (obj['api:journal'] && obj['api:journal'].issn === issn) {
      return obj['api:journal'];
    }
    for (const key in obj) {
      const found = findJournalByIssn(obj[key], issn);
      if (found) return found;
    }
  }
  return null;
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

function transformWork(workRelationship, relationshipId, expertId, elementsUserId, inputGraph) {
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
  const title = getBestFieldValueFromRecords('title', records);
  const abstract = getBestFieldValueFromRecords('abstract', records);
  const doi = getBestFieldValueFromRecords('doi', records);
  const issn = getBestFieldValueFromRecords('issn', records);
  const eissn = getBestFieldValueFromRecords('eissn', records);
  const journal = getBestFieldValueFromRecords('journal', records);
  const publisher = getBestFieldValueFromRecords('publisher', records);
  const volume = getBestFieldValueFromRecords('volume', records);
  const issue = getBestFieldValueFromRecords('issue', records);
  const language = getBestFieldValueFromRecords('language', records); // || 'en';
  const license = getBestFieldValueFromRecords('publisher-licence', records);
  const medium = getBestFieldValueFromRecords('medium', records); // || 'Undetermined';

  const dateAvailableField = records
      .map(r => r['api:native'] && r['api:native']['api:field']
        ? r['api:native']['api:field'].find(f => f.name === 'online-publication-date')
        : null)
      .find(f => !!f);
  const dateAvailable = formatDate(dateAvailableField?.['api:date']);

  const status = getBestFieldValueFromRecords('publication-status', records); // || 'Published';
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
  if (license) publication["http://citationstyles.org/schema/license"] = [{ "@value": license }];
  if (medium) publication["http://citationstyles.org/schema/medium"] = [{ "@value": medium }];
  if (dateAvailable) publication["http://citationstyles.org/schema/date-available"] = [{ "@value": dateAvailable }];
  if (status) publication["http://citationstyles.org/schema/status"] = [{ "@value": status }];
  if (url) publication["http://citationstyles.org/schema/url"] = [{ "@value": url }];
  if (dateValue) publication["http://citationstyles.org/schema/issued"] = [{ "@value": dateValue }];

  const typeMap = {
    "book": "book",
    "chapter": "chapter",
    "conference": "paper-conference",
    "journal-article": "article-journal",
    "dataset": "dataset",
    "internet-publication": "webpage",
    "media": "article",
    "other": "article",
    "poster": "speech",
    "preprint": "article",
    "presentation": "speech",
    "report": "report",
    "scholarly-edition": "manuscript",
    "software": "software",
    "thesis-dissertation": "thesis"
    // Add more as needed
  };

  // Try to get type from the publication object
  let rawType = jsonpath.value(workRelationship, '$["api:related"]["api:object"]["type"]');

  // Fallback: try to get from best record's api:field
  if (!rawType) {
    rawType = getBestFieldValueFromRecords('type', records);
  }

  const mappedType = typeMap[rawType] || rawType;
  if (mappedType) {
    publication["http://citationstyles.org/schema/type"] = [{ "@value": mappedType }];
  }

  if (issn) {
    const venueId = `http://experts.ucdavis.edu/venue/urn:issn:${issn}`;
    publication["http://vivoweb.org/ontology/core#hasPublicationVenue"] = [
      { "@id": venueId }
    ];

    let venueName = journal;
    for (const node of inputGraph) {
      const journalObj = findJournalByIssn(node, issn);
      if (journalObj && journalObj.title) {
        venueName = journalObj.title;
        break;
      }
    }

    // Create journal venue record
    result.push({
      "@id": venueId,
      "http://schema.org/name": [{ "@value": venueName }],
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

  let isVisible = workRelationship["api:is-visible"];
  if (typeof isVisible === "undefined" && workRelationship["api:relationship"]) {
    isVisible = workRelationship["api:relationship"]["api:is-visible"];
  }
  if (typeof isVisible === "string") {
    isVisible = isVisible.toLowerCase() === "true";
  }

  // Create authorship relationship record
  const authorship = {
    "@id": relationshipUri,
    "@type": [
      "http://schema.library.ucdavis.edu/schema#Authorship",
      "http://vivoweb.org/ontology/core#Authorship"
    ],
    "http://schema.library.ucdavis.edu/schema#is-visible": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(!!isVisible) }
    ],
    "http://vivoweb.org/ontology/core#rank": [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": "1" }
    ],
    "http://vivoweb.org/ontology/core#relates": [
      { "@id": publicationUri },
      { "@id": expertUri }
    ]
  };

  // Find the index of the expert in the authors array
  let userRank = null;
  for (let i = 0; i < authors.length; i++) {
    const author = authors[i];
    let links = author?.['api:links']?.['api:link'];
    if (!links) continue;
    if (!Array.isArray(links)) links = [links];
    if (links.some(link => link && (link.id === elementsUserId || link.id === String(elementsUserId)))) {
      userRank = i + 1;
      break;
    }
  }

  // If not found, fallback to previous logic or leave as null
  if (userRank !== null) {
    authorship["http://vivoweb.org/ontology/core#rank"] = [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": `${userRank}` }
    ];
  }

  result.push(authorship);

  return result;
}

export { transformWorks };
