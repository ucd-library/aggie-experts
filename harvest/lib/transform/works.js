import jsonpath from 'jsonpath';
import {
  formatDate,
  computeRecordScore,
  getBestFieldValueFromRecords,
  getBestFieldValuesFromRecords,
  extractAsArray,
  WORKS_SOURCE_ORDER,
  WORKS_TYPE_MAP,
  SCHEMA_URI_TYPE_MAP
} from './utils.js';

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

function getBestAuthorsPositionGroups(records, relationshipId) {
  // compute min score among records that have "authors", skipping unknown sources
  let minScore = Infinity;
  const recordsWithAuthors = [];
  for (let i = 0; i < (records || []).length; i++) {
    const rec = records[i];
    const fields = rec['api:native']?.['api:field'] || [];
    const authorsField = fields.find(f => f && f.name === 'authors');
    if (!authorsField) continue;

    const score = computeRecordScore(rec);
    if (!isFinite(score)) continue; // mirror SPARQL: ignore unknown sources for scoring

    recordsWithAuthors.push({ rec, score, idx: i });
    if (score < minScore) minScore = score;
  }

  // select tied best records (preserve original records array order)
  const bestRecords = recordsWithAuthors
    .filter(x => x.score === minScore)
    .sort((a, b) => a.idx - b.idx) // preserve original graph order for ties
    .map(x => x.rec);

  // fallback: first known-source record that has authors (also mirrors SPARQL fallback)
  if (bestRecords.length === 0) {
    for (const rec of records || []) {
      const src = rec?.['source-name'];
      if (WORKS_SOURCE_ORDER.indexOf(src) === -1) continue; // only known sources
      const fields = rec['api:native']?.['api:field'] || [];
      if (fields.find(f => f && f.name === 'authors')) {
        bestRecords.push(rec);
        break;
      }
    }
  }

  // build position groups: for each author index, collect persons from all bestRecords
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
    // iterate bestRecords in their original order; for each record take the person at idx
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

  // TODO
  // fix authors list on relationshipId 2454246 (jeisen)
  // authors 42 - 45 not showing up successfully
  // if( relationshipdId == '2454246' ) {
  //   console.log('--- recordsWithAuthors (detailed) ---');
  //   for (const rw of recordsWithAuthors) {
  //     const rec = rw.rec;
  //     const id = rec.id || rec['id-at-source'] || '<no-id>';
  //     const src = rec['source-name'] || '<no-src>';
  //     const score = rw.score;
  //     const fields = rec['api:native']?.['api:field'] || [];
  //     const doiField = fields.find(f => f && f.name === 'doi');
  //     let authorsField = fields.find(f => f && f.name === 'authors');
  //     let persons = authorsField?.['api:people']?.['api:person'];
  //     if (persons && !Array.isArray(persons)) persons = [persons];
  //     const authorsCount = persons ? persons.length : 0;
  //     const firstAuthor = persons && persons[0] ? `${persons[0]['api:last-name'] || ''},${persons[0]['api:first-names'] || ''}` : '<none>';
  //     console.log({ idx: rw.idx, id, src, score, hasDoi: !!doiField, authorsCount, firstAuthor });
  //   }
  //   console.log('--- bestRecords details ---');
  //   for (const br of bestRecords) {
  //     const id = br.id || br['id-at-source'] || '<no-id>';
  //     const src = br['source-name'] || '<no-src>';
  //     const fields = br['api:native']?.['api:field'] || [];
  //     let authorsField = fields.find(f => f && f.name === 'authors');
  //     let persons = authorsField?.['api:people']?.['api:person'];
  //     if (persons && !Array.isArray(persons)) persons = [persons];
  //     console.log('best record:', { id, src, authorsCount: persons ? persons.length : 0, persons });
  //   }
  // }

  return groups;
}

// function getAllValuesOfType(records, type) {
//   let values = new Set();
//   for (const rec of records) {
//     const fields = rec['api:native']?.['api:field'] || [];
//     for (const f of fields) {
//       if (f.name === type && f['api:text']) {
//         // If api:text is an array, add all; else add the single value
//         if (Array.isArray(f['api:text'])) {
//           f['api:text'].forEach(t => values.add(t));
//         } else {
//           values.add(f['api:text']);
//         }
//       }
//     }
//   }
//   return values;
// }

// function getBestIssn(records, pubObj) {
//   let bestScore = Infinity;
//   let bestIssns = [];

//   for (const record of records) {
//     const fields = record['api:native']?.['api:field'] || [];
//     const issnFields = fields.filter(f => f.name === 'issn' && f['api:text']);
//     if (!issnFields.length) continue;

//     // score with doi boost
//     const score = computeRecordScore(record);

//     if (score < bestScore) {
//       bestScore = score;
//       bestIssns = issnFields.flatMap(f =>
//         Array.isArray(f['api:text']) ? f['api:text'] : [f['api:text']]
//       );
//     } else if (score === bestScore) {
//       bestIssns.push(...issnFields.flatMap(f =>
//         Array.isArray(f['api:text']) ? f['api:text'] : [f['api:text']]
//       ));
//     }
//   }

//   // Fallback: check publication-level api:journal
//   if (!bestIssns.length && pubObj && pubObj['api:journal'] && pubObj['api:journal'].issn) {
//     bestIssns = [pubObj['api:journal'].issn];
//   }

//   // Return the first ISSN (SPARQL typically uses the first)
//   return bestIssns.length ? bestIssns[0] : undefined;
// }

function getBestDateObjectsFromRecords(fieldName, records, pubObj) {
  let bestScore = Infinity;
  const bestFields = [];

  for (const rec of records || []) {
    const fields = rec['api:native']?.['api:field'] || [];
    const matching = fields.filter(f => f && f.name === fieldName);
    if (!matching.length) continue;

    const score = computeRecordScore(rec);

    // ignore records with unknown/invalid score so they don't tie as "best"
    if (!isFinite(score)) continue;

    if (score < bestScore) {
      bestScore = score;
      bestFields.length = 0;
      bestFields.push(...matching);
    } else if (score === bestScore) {
      bestFields.push(...matching);
    }
  }

  // fallback: first known-source record that has the field
  if (bestFields.length === 0) {
    for (const rec of records || []) {
      const source = rec?.['source-name'];
      const order = WORKS_SOURCE_ORDER.indexOf(source);
      if (order === -1) continue;
      const fields = rec?.['api:native']?.['api:field'] || [];
      const matching = fields.filter(f => f && f.name === fieldName);
      if (matching.length) { bestFields.push(...matching); break; }
    }
  }

  if (!bestFields.length) return [];

  // return date objects (api:date) from all bestFields
  const dates = [];
  for (const f of bestFields) {
    const d = f['api:date'] || f;
    if (d) dates.push(d);
  }

  return dates;
}

function getBestPaginationValues(records) {
  let bestScore = Infinity;
  const bestRecords = [];

  for (const rec of records) {
    const fields = rec['api:native']?.['api:field'] || [];
    const pagField = fields.find(f => f && f.name === 'pagination' && f['api:pagination']);
    if (!pagField) continue;

    const score = computeRecordScore(rec);
    if (score < bestScore) {
      bestScore = score;
      bestRecords.length = 0;
      bestRecords.push(rec);
    } else if (score === bestScore) {
      bestRecords.push(rec);
    }
  }

  // fallback: first record that has pagination
  if (bestRecords.length === 0) {
    for (const rec of records) {
      const fields = rec['api:native']?.['api:field'] || [];
      if (fields.find(f => f && f.name === 'pagination' && f['api:pagination'])) {
        bestRecords.push(rec);
        break;
      }
    }
  }

  const pages = [];
  for (const rec of bestRecords) {
    const fields = rec['api:native']?.['api:field'] || [];
    for (const f of fields) {
      if (f.name === 'pagination' && f['api:pagination']) {
        const begin = f['api:pagination']['api:begin-page'];
        const end = f['api:pagination']['api:end-page'];
        let value = '';
        if (begin && end) value = `${begin}-${end}`;
        else if (begin) value = begin;
        if (value && !pages.includes(value)) pages.push(value);
      }
    }
  }

  return pages;
}

function getUserRank(records, elementsUserId, positionGroups) {
  // build scored list with scores (ignore non-finite)
  const scoredWithMeta = records
    .map((r, idx) => ({ r, score: computeRecordScore(r), idx }))
    .filter(x => Number.isFinite(x.score))
    .sort((a, b) => a.score - b.score); // sort by score only; stable in Node

  // For each score-group (tied best records), check all tied records and pick the minimal matching author index
  let userRank = null;
  for (let i = 0; i < scoredWithMeta.length;) {
    const groupScore = scoredWithMeta[i].score;
    const tied = [];
    let j = i;
    while (j < scoredWithMeta.length && scoredWithMeta[j].score === groupScore) {
      tied.push(scoredWithMeta[j].r);
      j++;
    }

    // find all matching person indices across tied records
    const matchingIndices = [];
    for (const rec of tied) {
      const authorsField = (rec['api:native']?.['api:field'] || []).find(f => f && f.name === 'authors');
      if (!authorsField) continue;
      let persons = authorsField['api:people']?.['api:person'];
      if (!persons) continue;
      if (!Array.isArray(persons)) persons = [persons];
      for (let pIdx = 0; pIdx < persons.length; pIdx++) {
        const person = persons[pIdx];
        let links = person?.['api:links']?.['api:link'];
        if (!links) continue;
        if (!Array.isArray(links)) links = [links];
        if (links.some(link => link && (
          link.id === elementsUserId ||
          String(link.id) === String(elementsUserId) ||
          (link.href && String(link.href).includes(String(elementsUserId)))
        ))) {
          matchingIndices.push(pIdx);
        }
      }
    }

    if (matchingIndices.length) {
      // choose the minimal author position across the tied records
      userRank = Math.min(...matchingIndices) + 1;
      break;
    }

    // advance to next score group
    i = j;
  }

  // fallback: check the merged positionGroups (covers when SPARQL's rank comes from merged best-record groups)
  if (userRank === null) {
    for (let pos = 0; pos < positionGroups.length; pos++) {
      const group = positionGroups[pos];
      for (const person of group) {
        let links = person?.['api:links']?.['api:link'];
        if (!links) continue;
        if (!Array.isArray(links)) links = [links];
        if (links.some(link => link && (
          link.id === elementsUserId ||
          String(link.id) === String(elementsUserId) ||
          (link.href && String(link.href).includes(String(elementsUserId)))
        ))) {
          userRank = pos + 1;
          break;
        }
      }
      if (userRank !== null) break;
    }
  }

  return userRank;
}

function transformWork(workRelationship, relationshipId, expertId, elementsUserId, inputGraph) {
  const result = [];

  const publicationId = jsonpath.value(workRelationship, '$["api:related"]["id"]');
  const publicationUri = `ark:/87287/d7mh2m/publication/${publicationId}`;
  const relationshipUri = `ark:/87287/d7mh2m/relationship/${relationshipId}`;
  const expertUri = `http://experts.ucdavis.edu/expert/${expertId}`;

  // Get the best record data (prefer manual > dimensions > crossref > others)
  const records = extractAsArray(workRelationship, '$["api:related"]["api:object"]["api:records"]["api:record"]');
  let primaryRecord = records.find(r => r['source-name'] === 'manual') ||
                     records.find(r => r['source-name'] === 'dimensions') ||
                     records.find(r => r['source-name'] === 'crossref') ||
                     records[0];

  if (!primaryRecord || !primaryRecord['api:native'] || !primaryRecord['api:native']['api:field']) return result;

  // const fields = primaryRecord['api:native']['api:field'] || [];

  // Extract publication data using jsonpath
  // const title = getBestFieldValueFromRecords('title', records);
  // Collect all unique titles from all records
  // const titles = getAllValuesOfType(records, 'title');
  const bestTitle = getBestFieldValuesFromRecords('title', records);
  const titles = Array.isArray(bestTitle) ? bestTitle : [bestTitle].filter(Boolean);

  const abstracts = getBestFieldValuesFromRecords('abstract', records);
  const dois = getBestFieldValuesFromRecords('doi', records) || [];

  // Collect all unique ISSNs from all records
  // sparql collects each publication, regardless of which record the ISSN
  // comes from. not just the primaryRecord
  // pull from fields
  // const issns = getAllValuesOfType(records, 'issn');
  // // and pull from journal objects
  const pubObj = workRelationship?.['api:related']?.['api:object'];
  // if (pubObj && pubObj['api:journal'] && pubObj['api:journal'].issn) {
  //   issns.add(pubObj['api:journal'].issn);
  // }

  const issn = getBestFieldValueFromRecords('issn', records);
  const eissn = getBestFieldValuesFromRecords('eissn', records);

  // sparql maps both isbn-10 and isbn-13 to cite:ISBN
  // so if multiple values, an array is returned
  const isbn13 = getBestFieldValueFromRecords('isbn-13', records);
  const isbn10 = getBestFieldValueFromRecords('isbn-10', records);
  const isbns = [];
  if (isbn13) isbns.push(isbn13);
  if (isbn10) isbns.push(isbn10);

  // sparql maps journal, parent-title, and name-of-conference to cite:container-title
  const journal = getBestFieldValuesFromRecords('journal', records) || [];
  const parentTitle = getBestFieldValuesFromRecords('parent-title', records) || [];
  const conferenceName = getBestFieldValuesFromRecords('name-of-conference', records) || [];
  const containerTitle =  Array.from(new Set([].concat(journal, parentTitle, conferenceName)));

  // sparql maps 'number' and 'series' to cite:collection-number
  const collectionNumber = getBestFieldValueFromRecords('number', records);
  const series = getBestFieldValueFromRecords('series', records);
  const collectionNumbers = [];
  if (collectionNumber) collectionNumbers.push(collectionNumber);
  if (series) collectionNumbers.push(series);

  const publisher = getBestFieldValueFromRecords('publisher', records);
  const volume = getBestFieldValuesFromRecords('volume', records)[0];
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

  // collect urls (public-url and oa-location-url) and map both to cite:url (same as sparql)
  const urlsPublic = getBestFieldValuesFromRecords('public-url', records) || [];
  const urlsOa = getBestFieldValuesFromRecords('oa-location-url', records) || [];
   // preserve order and dedupe
  const urls = Array.from(new Set([].concat(urlsPublic, urlsOa)));

  // Extract pagination
  const pageRanges = getBestPaginationValues(records);

  // Extract publication date(s)
  const pubDateFields = getBestDateObjectsFromRecords('publication-date', records, pubObj);
  const issuedDates = (pubDateFields || [])
    .map(d => formatDate(d['api:date'] ? d['api:date'] : d))
    .filter(Boolean);

  // Determine schema.org type (mirror SPARQL VALUES mapping)
  // to use in publication @type, and cite:type
  let rawType = jsonpath.value(pubObj, 'type') || getBestFieldValueFromRecords('type', records);
  const schemaTypeUri = SCHEMA_URI_TYPE_MAP[rawType] || SCHEMA_URI_TYPE_MAP['journal-article'];

  // Create main publication record with schema type + Work fallback
  const publication = {
    "@id": publicationUri,
    "@type": [
      schemaTypeUri,
      "http://schema.library.ucdavis.edu/schema#Work"
    ],
    "http://vivoweb.org/ontology/core#relatedBy": [
      { "@id": relationshipUri }
    ]
  };

  // Add optional fields
  if (titles.length) {
    publication["http://citationstyles.org/schema/title"] = titles.map(val => ({ "@value": val }));
  }
  if (abstracts.length) publication["http://citationstyles.org/schema/abstract"] = abstracts.map(val => ({ "@value": val }));
  if (dois.length) {
    publication["http://citationstyles.org/schema/DOI"] = Array.from(new Set(dois)).map(v => ({ "@value": v }));
  }
  if (issn) publication["http://citationstyles.org/schema/ISSN"] = [{ "@value": issn }];
  if (eissn.length) publication["http://citationstyles.org/schema/eissn"] = eissn.map(val => ({ "@value": val }));
  if (isbns.length ) publication["http://citationstyles.org/schema/ISBN"] = isbns.map(val => ({ "@value": val }));
  if (containerTitle.length) publication["http://citationstyles.org/schema/container-title"] = containerTitle.map(val => ({ "@value": val }));
  if (publisher) publication["http://citationstyles.org/schema/publisher"] = [{ "@value": publisher }];
  if (volume) publication["http://citationstyles.org/schema/volume"] = [{ "@value": volume }];
  if (pageRanges.length) {
    publication["http://citationstyles.org/schema/page"] = pageRanges.map(val => ({ "@value": val }));
  }
  if (collectionNumbers.length) publication["http://citationstyles.org/schema/collection-number"] = collectionNumbers.map(val => ({ "@value": val }));
  if (issue) publication["http://citationstyles.org/schema/issue"] = [{ "@value": issue }];
  if (language) publication["http://citationstyles.org/schema/language"] = [{ "@value": language }];
  if (license) publication["http://citationstyles.org/schema/license"] = [{ "@value": license }];
  if (medium) publication["http://citationstyles.org/schema/medium"] = [{ "@value": medium }];
  if (dateAvailable) publication["http://citationstyles.org/schema/date-available"] = [{ "@value": dateAvailable }];
  if (status) publication["http://citationstyles.org/schema/status"] = [{ "@value": status }];
  if (urls.length) publication["http://citationstyles.org/schema/url"] = urls.map(u => ({ "@value": u }));
  if (issuedDates.length) {
    publication["http://citationstyles.org/schema/issued"] = issuedDates.map(v => ({ "@value": v }));
  }

  // set cite:type
  const mappedType = WORKS_TYPE_MAP[rawType] || rawType;
  if (mappedType) {
    publication["http://citationstyles.org/schema/type"] = [{ "@value": mappedType }];
  }

  // only create publicationVenue when the publication-level api:journal is present
  let mainIssn = undefined;
  if (pubObj && pubObj['api:journal'] && pubObj['api:journal'].issn) {
    mainIssn = pubObj['api:journal'].issn;
  }

  // only emit hasPublicationVenue and the venue node when api:journal exists on the publication (matches the ?pub :journal OPTIONAL in .rq)
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
    if (Array.isArray(venueName)) venueName = venueName[0];

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
  let positionGroups = getBestAuthorsPositionGroups(records, workRelationship.id);
  // console.log('workrelationshipId', workRelationship.id);

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

  // normalize favourite flag
  let isFavourite = workRelationship["api:is-favourite"];
  if (typeof isFavourite === "string") {
    isFavourite = isFavourite.toLowerCase() === "true";
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
    "http://vivoweb.org/ontology/core#relates": [
      { "@id": publicationUri },
      { "@id": expertUri }
    ]
  };

  // include favourite only when true
  if (isFavourite) {
    authorship["http://schema.library.ucdavis.edu/schema#favourite"] = [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": String(!!isFavourite) }
    ];
  }

  // compute user rank / best score for elements user vs authors positions
  const userRank = getUserRank(records, elementsUserId, positionGroups);

  if (userRank !== null) {
    authorship["http://vivoweb.org/ontology/core#rank"] = [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": `${userRank}` }
    ];
  }

  result.push(authorship);

  return result;
}

export { transformWorks };
