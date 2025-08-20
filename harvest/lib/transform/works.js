import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, getBestFieldValueFromRecords, getBestFieldValuesFromRecords, getFieldObject, extractAsArray, WORKS_SOURCE_ORDER } from './utils.js';

function transformWorks(works, expertId, elementsUserId, inputGraph) {
  let results = [];
  works.forEach(work => {
    let relationshipId = work.id;
    results.push({ relationshipId, graph: transformWork(work, relationshipId, expertId, elementsUserId, inputGraph) });
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
  for (const sourceName of WORKS_SOURCE_ORDER) {
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

// function toArray(val) {
//   if (Array.isArray(val)) return val;
//   if (val === undefined || val === null) return [];
//   return [val];
// }

// function collectAllNames(records, author) {
//   const familyNames = new Set();
//   const givenNames = new Set();

//   // Try to match by last/given name, or by some unique property if available
//   const lastName = author['api:last-name'];
//   const firstName = author['api:first-names'];

//   for (const rec of records) {
//     const fields = rec['api:native']?.['api:field'] || [];
//     const authorsField = fields.find(f => f && f.name === 'authors');
//     if (!authorsField) continue;
//     let people = authorsField['api:people']?.['api:person'];
//     if (!people) continue;
//     if (!Array.isArray(people)) people = [people];

//     for (const a of people) {
//       // Match on last/given name (or use a better unique key if available)
//       if (
//         (a['api:last-name'] === lastName && a['api:first-names'] === firstName)
//         // Optionally add more robust matching here
//       ) {
//         toArray(a['api:last-name']).forEach(n => familyNames.add(n));
//         toArray(a['api:first-names']).forEach(n => givenNames.add(n));
//       }
//     }
//   }

//   return {
//     family: Array.from(familyNames),
//     given: Array.from(givenNames)
//   };
// }

function getAllValuesOfType(records, type) {
  let values = new Set();
  for (const rec of records) {
    const fields = rec['api:native']?.['api:field'] || [];
    for (const f of fields) {
      if (f.name === type && f['api:text']) {
        // If api:text is an array, add all; else add the single value
        if (Array.isArray(f['api:text'])) {
          f['api:text'].forEach(t => values.add(t));
        } else {
          values.add(f['api:text']);
        }
      }
    }
  }
  return values;
}

// function getAllAuthors(records) {
//   const authors = [];
//   for (const rec of records) {
//     const fields = rec['api:native']?.['api:field'] || [];
//     const authorsField = fields.find(f => f && f.name === 'authors');
//     if (!authorsField) continue;
//     let people = authorsField['api:people']?.['api:person'];
//     if (!people) continue;
//     if (!Array.isArray(people)) people = [people];
//     for (const a of people) {
//       // Optionally, use a unique key to avoid duplicates (e.g., ORCID, Elements ID, or last+first name)
//       authors.push(a);
//     }
//   }
//   return authors;
// }

function getBestIssn(records, pubObj) {
  let bestScore = Infinity;
  let bestIssns = [];

  for (const record of records) {
    const source = record['source-name'];
    if (!source) continue;
    const order = WORKS_SOURCE_ORDER.indexOf(source);
    if (order === -1) continue;

    const fields = record['api:native']?.['api:field'] || [];
    const issnFields = fields.filter(f => f.name === 'issn' && f['api:text']);
    if (!issnFields.length) continue;

    let score = order + 1;
    if (fields.some(f => f.name === 'doi')) score -= 10;

    if (score < bestScore) {
      bestScore = score;
      bestIssns = issnFields.flatMap(f =>
        Array.isArray(f['api:text']) ? f['api:text'] : [f['api:text']]
      );
    } else if (score === bestScore) {
      bestIssns.push(...issnFields.flatMap(f =>
        Array.isArray(f['api:text']) ? f['api:text'] : [f['api:text']]
      ));
    }
  }

  // Fallback: check publication-level api:journal
  if (!bestIssns.length && pubObj && pubObj['api:journal'] && pubObj['api:journal'].issn) {
    bestIssns = [pubObj['api:journal'].issn];
  }

  // Return the first ISSN (SPARQL typically uses the first)
  return bestIssns.length ? bestIssns[0] : undefined;
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
  // const title = getBestFieldValueFromRecords('title', records);
  // Collect all unique titles from all records
  // const titles = getAllValuesOfType(records, 'title');
  const bestTitle = getBestFieldValuesFromRecords('title', records);
  const titles = Array.isArray(bestTitle) ? bestTitle : [bestTitle].filter(Boolean);

  const abstract = getBestFieldValueFromRecords('abstract', records);
  const doi = getBestFieldValueFromRecords('doi', records);

  // Collect all unique ISSNs from all records
  // The sparql collects each publication, regardless of which record the ISSN
  // comes from. not just the primaryRecord
  // pull from fields
  const issns = getAllValuesOfType(records, 'issn');
  // and pull from journal objects
  const pubObj = workRelationship?.['api:related']?.['api:object'];
  if (pubObj && pubObj['api:journal'] && pubObj['api:journal'].issn) {
    issns.add(pubObj['api:journal'].issn);
  }

  const issn = getBestFieldValueFromRecords('issn', records);
  const eissn = getBestFieldValueFromRecords('eissn', records);

  // the SPARQL query maps both isbn-10 and isbn-13 to cite:ISBN
  // so if multiple values, an array is returned
  const isbn13 = getBestFieldValueFromRecords('isbn-13', records);
  const isbn10 = getBestFieldValueFromRecords('isbn-10', records);
  const isbns = [];
  if (isbn13) isbns.push(isbn13);
  if (isbn10) isbns.push(isbn10);

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
  // const pagination = getFieldObject(fields, 'pagination');
  // const pages = pagination ? `${pagination['api:begin-page']}-${pagination['api:end-page']}` : null;
  let pageRanges = [];
  for (const rec of records) {
    const fields = rec['api:native']?.['api:field'] || [];
    for (const f of fields) {
      if (f.name === 'pagination' && f['api:pagination']) {
        const begin = f['api:pagination']['api:begin-page'];
        const end = f['api:pagination']['api:end-page'];
        let value = '';
        if (begin && end) value = `${begin}-${end}`;
        else if (begin) value = begin;
        if (value && !pageRanges.includes(value)) pageRanges.push(value);
      }
    }
  }

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
  // if (title) publication["http://citationstyles.org/schema/title"] = [{ "@value": title }];
  if (titles.length) {
    publication["http://citationstyles.org/schema/title"] = titles.map(val => ({ "@value": val }));
  }
  if (abstract) publication["http://citationstyles.org/schema/abstract"] = [{ "@value": abstract }];
  if (doi) publication["http://citationstyles.org/schema/DOI"] = [{ "@value": doi }];
  if (issn) publication["http://citationstyles.org/schema/ISSN"] = [{ "@value": issn }];
  if (eissn) publication["http://citationstyles.org/schema/eissn"] = [{ "@value": eissn }];
  if (isbns.length ) publication["http://citationstyles.org/schema/ISBN"] = isbns.map(val => ({ "@value": val }));
  if (journal) publication["http://citationstyles.org/schema/container-title"] = [{ "@value": journal }];
  if (publisher) publication["http://citationstyles.org/schema/publisher"] = [{ "@value": publisher }];
  if (volume) publication["http://citationstyles.org/schema/volume"] = [{ "@value": volume }];
  // if (pages) publication["http://citationstyles.org/schema/page"] = [{ "@value": pages }];
  if (pageRanges.length) {
    publication["http://citationstyles.org/schema/page"] = pageRanges.map(val => ({ "@value": val }));
  }
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

  // for publicationVenue, prefer issn from pub level (api:jounal -> issn)
  // otherwise get the best issn from the records
  let mainIssn = undefined;
  if (pubObj && pubObj['api:journal'] && pubObj['api:journal'].issn) {
    mainIssn = pubObj['api:journal'].issn;
  } else {
    mainIssn = getBestIssn(records, pubObj);
  }

  if (mainIssn) {
    publication["http://vivoweb.org/ontology/core#hasPublicationVenue"] = [
      { "@id": `http://experts.ucdavis.edu/venue/urn:issn:${mainIssn}` }
    ];

    const venueId = `http://experts.ucdavis.edu/venue/urn:issn:${mainIssn}`;
    let venueName = journal;
    for (const node of inputGraph) {
      const journalObj = findJournalByIssn(node, mainIssn);
      if (journalObj && journalObj.title) {
        venueName = journalObj.title;
        break;
      }
    }

    result.push({
      "@id": venueId,
      "http://schema.org/name": [{ "@value": venueName }],
      "http://vivoweb.org/ontology/core#issn": [{ "@value": mainIssn }]
    });
  }

  // Create author records and add to publication
  const authorUris = [];
  authors.forEach((author, index) => {
    const rank = index + 1;
    const authorUri = `${publicationUri}#${rank}`;
    authorUris.push({ "@id": authorUri });

    // const { family, given } = collectAllNames(records, author);

    // if( workRelationship.id == '6529533' ) {
    //   console.log(family, given, author);
    //   console.log(JSON.stringify(records))
    // }

    const lastName = jsonpath.value(author, '$["api:last-name"]');
    const firstName = jsonpath.value(author, '$["api:first-names"]');
                                            // || jsonpath.value(author, '$["api:initials"]');

    result.push({
      "@id": authorUri,
      "http://citationstyles.org/schema/family": [{ "@value": lastName }],
      "http://citationstyles.org/schema/given": [{ "@value": firstName }],

      // "http://citationstyles.org/schema/family": family.map(val => ({ "@value": val })),
      // "http://citationstyles.org/schema/given": given.map(val => ({ "@value": val })),

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
