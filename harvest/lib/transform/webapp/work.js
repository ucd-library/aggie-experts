import cache from '../../cache.js';
import logger from '../../logger.js';
import {frame, simplifiedExpert} from './frame.js';
import {getGraphAsItems, getNodeByType, asArray, SHORT_TYPES} from '../utils.js';
import { getYearWeek } from '../../year-week.js';

/**
 * @method generateWork 
 * @description Given a work subject, transform the corresponding work
 * 
 * @param {String} subject the subject URI of the work to transform
 * @param {Object} opts 
 */
async function generateWork(subject, opts={}) {
  const partitionKeys = ['year-week-'+getYearWeek(opts.date), 'ae-std'];
  let relNodes = [];
  let expertNodes = [];

  const rdfResp = await cache.findRelatedExperts(subject, {partitionKeys});
  let workNode = null;

  // loop through all found rel files, extract the authorship nodes that relate to an expert
  for (const res of rdfResp.results) {
    const fp = res.filepath;
    if (!fp) continue;
    try {
      const rel = JSON.parse(await cache.read(fp));
      if ( !workNode ) {
        workNode = getNodeByType(rel, SHORT_TYPES.WORKS, {match: true});
      }

      const items = getGraphAsItems(rel);

      for (const node of items) {
        let parsedNode = _parseWorkNode(subject, node);
        if( !parsedNode ) continue;
        
        relNodes.push(parsedNode);
        let expert = await _findWorkExpert(parsedNode, partitionKeys, subject);        
        if( expert ) expertNodes.push(expert);
      }
    } catch (e) {
      logger.error(`Failed to read/parse RDF-found rel file ${fp}`, e);
    }
  }

  let workGraph = await frame([workNode]);
  let relGraph = await frame(relNodes);
  workGraph = [...workGraph["@graph"], ...relGraph["@graph"], ...expertNodes];

  workGraph = workGraph.map(node => {
    if( node.rank ) node.rank = parseInt(node.rank);
    if( node['is-visible'] ) node['is-visible'] = node['is-visible'] === 'true';
    return node;
  });

  return workGraph;
}

async function _findWorkExpert(workRelNode, partitionKeys, subject) {
  // TODO: lets precook this
  let expertId = asArray(workRelNode['http://vivoweb.org/ontology/core#relates'])
    .find(value => value['@id'].startsWith('http://experts.ucdavis.edu/expert/'));

  if( !expertId ) {
    logger.warn(`No expert relates found in node ${workRelNode['@id']} for subject ${subject}`);
    return null;
  }

  expertId = expertId['@id'];
  let relatedExpert = await cache.findRelatedExperts(expertId, {partitionKeys});
  if( !relatedExpert.results.length ) {
    logger.warn(`No related experts found for expertId ${expertId} in node ${workRelNode['@id']} for subject ${subject}`);
    return null;
  }

  let person = JSON.parse(await cache.read(relatedExpert.results[0].filepath));

  person = await frame(person);

  person = getNodeByType(person, SHORT_TYPES.EXPERT, {match: true});

  return simplifiedExpert(person);
}


function _parseWorkNode(subject, node) {
  if (!node || !node['@id']) return;

  // Only consider relationship nodes
  if (!(typeof node['@id'] === 'string' && node['@id'].includes('/relationship/'))) {
    logger.debug(`Skipping non-relationship node ${node['@id']}`);
    return;
  }

  const relatesAny = node['http://vivoweb.org/ontology/core#relates'] || node['ucdlib:relates-to'] || node['relatesTo'];
  const relatesArr = Array.isArray(relatesAny) ? relatesAny : (relatesAny ? [relatesAny] : []);
  if (!relatesArr.length) {
    logger.warn(`Relationship node ${node['@id']} has no relates field`);
    return;
  }

  // must reference the publication subject
  const referencesPub = relatesArr.some(r => {
    const rid = (typeof r === 'string') ? r : (r && r['@id'] ? r['@id'] : null);
    return rid && rid.split('#')[0] === subject;
  });
  if (!referencesPub) {
    logger.warn(`Relationship node ${node['@id']} does not reference the publication subject ${subject}`);
    return;
  }

  // clone node and set vivoweb relates to the collected relates
  const outNode = JSON.parse(JSON.stringify(node));
  outNode['http://vivoweb.org/ontology/core#relates'] = relatesArr;
  
  return outNode;
}

export {
  generateWork
};