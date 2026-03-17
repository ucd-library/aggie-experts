import Ollama from '../ollama.js';
import PgClient from '../pg-client.js';
import { getEsClient } from '../elasticsearch/index.js';
import { getYearWeek } from '../year-week.js';
import config from '../config.js';
import { logger } from '../logger.js';

function getTargetYearWeek(opts={}) {
  if( opts.yearWeek ) return opts.yearWeek;
  return getYearWeek({ date: opts.date });
}

async function getNewExpertsByYearWeek(pgClient, yearWeek, opts={}) {
  const schema = opts.schema || 'etl_reporting';
  const tableName = opts.userTable || '"user"';

  const query = `
SELECT 
  email as user_id,
  expert_id,
  first_seen_cdl,
  is_public,
  first_seen_cdl
FROM ${schema}."user"
WHERE (SELECT year_week from ${schema}.get_year_week(first_seen_cdl::DATE)) = 
      (SELECT year_week from ${schema}.get_year_week((NOW() - interval '7 days')::DATE))
  `;

  const resp = await pgClient.query(query);
  return resp.rows || [];
}

async function getExpertsFromEs(esClient, expertIds, alias='latest') {
  if( !expertIds.length ) return [];

  const docs = expertIds.map(id => ({ _index: `experts-${alias}`, _id: `expert/${id}` }));
  const resp = await esClient.mget({ docs });

  return (resp.docs || [])
    .filter(doc => doc.found)
    .map(doc => ({
      id: doc._id,
      source: doc._source
    }));
}

async function getWorksForExpert(esClient, expertDocId, alias='latest', size=1000) {
  const resp = await esClient.search({
    index: `works-${alias}`,
    body: {
      query: {
        nested: {
          path: '@graph',
          query: {
            term: {
              '@graph.@id': expertDocId
            }
          }
        }
      }
    },
    size
  });

  return (resp.hits?.hits || []).map(hit => ({
    id: hit._id,
    source: hit._source
  }));
}

function buildPrompt(payload, yearWeek) {
  return [
    'You are summarizing newly indexed experts and their scholarly works for Aggie Experts.',
    `Focus on year_week: ${yearWeek}.`,
    'Write a detailed but readable narrative summary that includes:',
    '1) Key research themes across experts',
    '2) Notable works and trends',
    '3) Any interdisciplinary patterns and collaborations implied by the data',
    '4) A concise bullet list of top highlights at the end',
    '',
    'Input data JSON:',
    JSON.stringify(payload, null, 2)
  ].join('\n');
}

async function summerizeNewExperts(opts={}) {
  const yearWeek = getTargetYearWeek(opts);
  const alias = opts.alias || config.elasticsearch.aliases.stage;
  const llmModel = opts.model || config.llm.model;
  const llmHost = opts.host || config.llm.host;

  const pgClient = opts.pgClient || new PgClient(opts.pgConfig);
  const esClient = opts.esClient || await getEsClient();

  let rows = [];
  try {
    rows = await getNewExpertsByYearWeek(pgClient, yearWeek, opts);
  } finally {
    if( !opts.pgClient ) {
      await pgClient.end();
    }
  }



  const expertIds = [...new Set(rows.map(row => row.expert_id).filter(Boolean))];
  const experts = await getExpertsFromEs(esClient, expertIds, alias);

  const payload = {
    yearWeek,
    counts: {
      users: rows.length,
      experts: experts.length,
    },
    users: rows,
    experts: experts
  };

  logger.info(`Generating new expert summary for year_week=${yearWeek}`, {
    users: payload.counts.users,
    experts: payload.counts.experts,
    alias,
    llmModel
  });

  const ollama = new Ollama();
  const prompt = buildPrompt(payload, yearWeek);
  const llmResp = await ollama.generate({
    model: llmModel,
    prompt,
    stream: false
  });

  return llmResp;
}


export {
  summerizeNewExperts,
  getTargetYearWeek,
  getNewExpertsByYearWeek,
  getExpertsFromEs,
  getWorksForExpert,
  buildPrompt
};

export default summerizeNewExperts;
