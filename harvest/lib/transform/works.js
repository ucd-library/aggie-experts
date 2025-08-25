import jsonpath from 'jsonpath';
import { formatDate, getFieldValue, computeRecordScore, getBestFieldValueFromRecords, getBestFieldValuesFromRecords, getFieldObject, extractAsArray, WORKS_SOURCE_ORDER, WORKS_TYPE_MAP } from './utils.js';

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

function getBestAuthorsPositionGroups(records) {
  // find best-score records for the "authors" field (may be multiple ties)
  let bestScore = Infinity;
  const bestRecords = [];

  for (const rec of records) {
    const fields = rec['api:native']?.['api:field'] || [];
    const authorsField = fields.find(f => f && f.name === 'authors');
    if (!authorsField) continue;

    // score with doi boost
    const score = computeRecordScore(rec);

    if (score < bestScore) {
      bestScore = score;
      bestRecords.length = 0;
      bestRecords.push(rec);
    } else if (score === bestScore) {
      bestRecords.push(rec);
    }
  }

  // fallback: any single record with authors
  if (bestRecords.length === 0) {
    for (const rec of records) {
      const fields = rec['api:native']?.['api:field'] || [];
      if (fields.find(f => f && f.name === 'authors')) {
        bestRecords.push(rec);
        break;
      }
    }
  }

  // Build position groups: for each author index, collect persons from all bestRecords
  const groups = [];
  let maxLen = 0;
  const recordsPersons = bestRecords.map(rec => {
    const authorsField = (rec['api:native']?.['api:field'] || []).find(f => f && f.name === 'authors');
    let persons = authorsField?.['api:people']?.['api:person'];
    if (!persons) return [];
    if (!Array.isArray(persons)) persons = [persons];
    maxLen = Math.max(maxLen, persons.length);
    return persons;
  });

  for (let idx = 0; idx < maxLen; idx++) {
    const seen = new Set();
    const group = [];
    for (const persons of recordsPersons) {
      const p = persons[idx];
      if (!p) continue;
      const key = `${p['api:last-name'] || ''}|${p['api:first-names'] || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        group.push(p);
      }
    }
    if (group.length) groups.push(group);
  }

  return groups; // array of groups; groups[i] is array of person objects for position i
}

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

function getBestIssn(records, pubObj) {
  let bestScore = Infinity;
  let bestIssns = [];

  for (const record of records) {
    const fields = record['api:native']?.['api:field'] || [];
    const issnFields = fields.filter(f => f.name === 'issn' && f['api:text']);
    if (!issnFields.length) continue;

    // score with doi boost
    const score = computeRecordScore(record);

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

function getBestDateObjectFromRecords(fieldName, records, pubObj) {
  let bestScore = Infinity;
  const bestFields = [];

  for (const rec of records) {
    const fields = rec['api:native']?.['api:field'] || [];
    const matching = fields.filter(f => f && f.name === fieldName);
    if (!matching.length) continue;

    // score with doi boost
    const score = computeRecordScore(rec);

    if (score < bestScore) {
      bestScore = score;
      bestFields.length = 0;
      bestFields.push(...matching);
    } else if (score === bestScore) {
      bestFields.push(...matching);
    }
  }

  // fallback to publication-level object if no field found in records
  if (!bestFields.length && pubObj && pubObj['api:journal'] === undefined && pubObj['api:records'] === undefined) {
    if (pubObj && pubObj['api:reporting-date-1']) {
      return { 'api:date': { api: { year: pubObj['api:reporting-date-1'] } } }; // minimal fallback
    }
  }

  if (!bestFields.length) return undefined;

  // prefer a field that has api:date with year+month+day, then year+month, then year
  let chosen = null;
  for (const f of bestFields) {
    const d = f['api:date'];
    if (d && d['api:year'] && d['api:month'] && d['api:day']) { chosen = f; break; }
  }
  if (!chosen) {
    for (const f of bestFields) {
      const d = f['api:date'];
      if (d && d['api:year'] && d['api:month']) { chosen = f; break; }
    }
  }
  if (!chosen) chosen = bestFields[0];

  return chosen['api:date'] ? chosen : chosen;
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
  // sparql collects each publication, regardless of which record the ISSN
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

  // sparql maps both isbn-10 and isbn-13 to cite:ISBN
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
  // sparql builds the issued date from the publication-date field chosen from the record(s)
  // with the minimum score (source order + DOI boost).
  // pick the publication-date from the best-score record(s) the same way you pick other best fields. Add a helper that finds the best record(s) for a given field and returns the most specific date (prefer year+month+day), then format it.
  const pubDateField = getBestDateObjectFromRecords('publication-date', records, pubObj);
  const issuedDate = formatDate(pubDateField ? (pubDateField['api:date'] || pubDateField) : undefined);

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
  if (issuedDate) publication["http://citationstyles.org/schema/issued"] = [{ "@value": issuedDate }];

  // Try to get type from the publication object
  let rawType = jsonpath.value(workRelationship, '$["api:related"]["api:object"]["type"]');

  // Fallback: try to get from best record's api:field
  if (!rawType) {
    rawType = getBestFieldValueFromRecords('type', records);
  }

  const mappedType = WORKS_TYPE_MAP[rawType] || rawType;
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

  // authors
  // - Choose the tied best-score records.
  // - For each author position index, collect all person entries from those tied records at that index.
  // - Create one author node per position, with family/given arrays built from those persons (deduped).
  // - Compute expert rank by checking links within each position group.
  let positionGroups = getBestAuthorsPositionGroups(records);

  // create author nodes: one node per position, family/given arrays from group
  const authorUris = [];
  positionGroups.forEach((group, idx) => {
    const authorUri = `${publicationUri}#${idx + 1}`;
    authorUris.push({ "@id": authorUri });

    // collect family and given values from all persons in this position group
    const familyVals = [];
    const givenVals = [];
    const seenFamily = new Set();
    const seenGiven = new Set();
    for (const person of group) {
      const fam = person['api:last-name'];
      const giv = person['api:first-names'];
      if (fam && !seenFamily.has(fam)) { seenFamily.add(fam); familyVals.push(fam); }
      if (giv && !seenGiven.has(giv)) { seenGiven.add(giv); givenVals.push(giv); }
    }

    result.push({
      "@id": authorUri,
      "http://citationstyles.org/schema/family": familyVals.map(v => ({ "@value": v })),
      "http://citationstyles.org/schema/given": givenVals.map(v => ({ "@value": v })),
      "http://vivoweb.org/ontology/core#rank": [
        { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": `${idx + 1}` }
      ]
    });
  });

  if (authorUris.length) {
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

  // determine expert's rank: check links inside each position group
  let userRank = null;
  for (let i = 0; i < positionGroups.length; i++) {
    const group = positionGroups[i];
    for (const person of group) {
      let links = person?.['api:links']?.['api:link'];
      if (!links) continue;
      if (!Array.isArray(links)) links = [links];
      if (links.some(link => link && (link.id === elementsUserId || link.id === String(elementsUserId)))) {
        userRank = i + 1;
        break;
      }
    }
    if (userRank !== null) break;
  }

  if (userRank !== null) {
    authorship["http://vivoweb.org/ontology/core#rank"] = [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": `${userRank}` }
    ];
  }

  result.push(authorship);

  return result;
}

export { transformWorks };
