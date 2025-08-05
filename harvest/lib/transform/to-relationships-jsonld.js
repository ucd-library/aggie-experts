import jsonpath from 'jsonpath';
import fs from 'fs';
import path from 'path';

import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';

import {transformWorks} from './works.js';
import {transformGrants} from './grants.js';

import {sortJsonArrayByIdAndKeys} from './utils.js';

async function run(rel, expertId, options = {}) {
  let {
    works,
    grants
  } = parseRelationshipTypes(rel);

  works = transformWorks(works, expertId);
  grants = transformGrants(grants, expertId);

  await saveRelationshipFiles([...works, ...grants], expertId, options);

  return { success: true, works: works.length, grants: grants.length };
}

async function runFromFiles(relationshipFiles, expertId, options) {
  if (!relationshipFiles || relationshipFiles.length === 0) {
    logger.warn(`No relationship files provided for user: ${options.user}`);
    return;
  }

  logger.info(`Running AE std relationship transformation for user: ${options.user}`);
  for( let file of relationshipFiles ) {
    logger.info(`Processing relationship file: ${file}`);
    let rel = JSON.parse(fs.readFileSync(file, 'utf8'));
    await run(rel, expertId, options);
  }

  return { success: true, message: "Transformation completed" };
}

async function saveRelationshipFiles(relationships, expertId, options) {
  for( let relationship of relationships ) {
    let { relationshipId, graph } = relationship;
    graph = sortJsonArrayByIdAndKeys(graph);

    logger.info(`Saving relationship file for expert ID: ${expertId}, relationship ID: ${relationshipId}, path: ${path.join(config.cache.aeStdFormatDir + `/${expertId}/ark:/87287/d7mh2m/`, `${relationshipId}.jsonld`)}`);
    await cache.writeUserAsset(
      'ae-std-relationship-transform',
      options.user,
      path.join(config.cache.aeStdFormatDir + `/${expertId}/rel/`, `${relationshipId}.jsonld`),
      graph
    );
  }
}

// Trim extraneous info from authors
// function author_trim_info(author) {
//   delete (author['api:addresses']);
// }

// // modify author information
// function update_author(me, work) {
//   const max_authors = me.author_truncate_to;
//   let records = work?.['api:object']?.['api:records']?.['api:record'] || [];
//   Array.isArray(records) || (records = [records]);
//   records.forEach((record) => {
//     // log.info(`record: ${record.id}`);
//     let fields = record?.['api:native']?.['api:field'] || [];
//     Array.isArray(fields) || (fields = [fields]);
//     fields.forEach((field) => {
//       if (field.name === 'authors') {
//         let authors = field?.['api:people']?.['api:person'] || [];
//         Array.isArray(authors) || (authors = [authors]);
//         for (let i = 0; i < (authors.length < max_authors ? authors.length : max_authors); i++) {
//           if (me.author_trim_info) { author_trim_info(authors[i]); }
//         }
//         if (authors.length>1) {
//           if (me.author_trim_info) { author_trim_info(authors[authors.length-1]); }
//         }
//         authors.splice(max_authors, authors.length - max_authors - 1);
//       }
//     });
//   });
//   return work;
// }

// function initTransform(graph) {
//   let results = [];
//   for (let work of graph['@graph']) {
//     let related = [];
//     if (work['api:relationship']?.['api:related']) {
//       if (this.author_truncate_to || this.author_trim_info) {
//         related.push(update_author(this, work['api:relationship']['api:related']))
//       } else {
//         related.push(work['api:relationship']['api:related'])
//       }
//     }
//     related.push({ direction: 'to', id: cdlId, category: 'user' })
//     work['api:relationship'] ||= {};
//     work['api:relationship']['api:related'] = related;
//     results.push(work['api:relationship']);
//   }
//   return results;
// }

function parseRelationshipTypes(rel) {
  let allRelationships = jsonpath.query(rel, '$..["api:relationship"]');

  let works = allRelationships.filter(r => r.type === "publication-user-authorship");
  let grants = allRelationships.filter(r => r.type === "user-grant-research");

  return { works, grants };
}

export { run, runFromFiles, saveRelationshipFiles };
