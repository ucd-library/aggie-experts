const router = require('express').Router();
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const GrantModel = require('../grant/model.js');
const WorkModel = require('../work/model.js');
const {Elasticsearch, Ollama, config} = require('@ucd-lib/experts-commons');

const base = new BaseModel();
const experts = new ExpertModel();
const grants = new GrantModel();
const works = new WorkModel();

const { openapi, public_or_is_user, valid_path, valid_path_error } = require('../middleware/index.js');

/**
 * @function buildBm25Query
 * @description Build the BM25 multi-match clause for the flat ae-search index.
 * @param {string} q user query string
 * @returns {Object} Elasticsearch query clause
 */
function buildBm25Query(q) {
  return {
    multi_match: {
      query: q,
      fields: [
        'name^20',
        'title^2',
        'abstract'
      ],
      type: 'best_fields'
    }
  };
}

/**
 * @function buildAeSearchAggs
 * @description Build the aggregation block for the ae-search index query.
 * Produces type counts, year histograms for works and grants, and facet counts.
 * @returns {Object} Elasticsearch aggs object
 */
function buildAeSearchAggs() {
  return {
    type_counts: {
      terms: { field: '@type', size: 10 }
    },
    works_years: {
      filter: { term: { '@type': 'work' } },
      aggs: {
        years: {
          date_histogram: {
            field: 'issued',
            calendar_interval: 'year',
            format: 'epoch_millis',
            min_doc_count: 1
          }
        }
      }
    },
    grants_years: {
      filter: { term: { '@type': 'grant' } },
      aggs: {
        years: {
          date_histogram: {
            field: 'dateTimeInterval.start.dateTime',
            calendar_interval: 'year',
            format: 'epoch_millis',
            min_doc_count: 1
          }
        }
      }
    },
    availability_counts: {
      filter: { term: { '@type': 'expert' } },
      aggs: {
        counts: { terms: { field: 'hasAvailability.prefLabel', size: 20 } }
      }
    },
    status_counts: {
      filter: { terms: { '@type': ['work', 'grant'] } },
      aggs: {
        counts: { terms: { field: 'status', size: 20 } }
      }
    },
    work_type_counts: {
      filter: { term: { '@type': 'work' } },
      aggs: {
        counts: { terms: { field: 'type', size: 20 } }
      }
    }
  };
}

/**
 * @function buildDatePostFilter
 * @description Build a date-range post_filter clause that applies to works (issued)
 * and grants (dateTimeInterval) independently within a single should.
 * @param {string} [dateFrom] ISO date string for range start
 * @param {string} [dateTo] ISO date string for range end
 * @returns {Object} Elasticsearch bool clause
 */
function buildDatePostFilter(dateFrom, dateTo) {
  const dateRange = {};
  if (dateFrom) dateRange.gte = dateFrom;
  if (dateTo) dateRange.lte = dateTo;

  return {
    bool: {
      should: [
        {
          bool: {
            must: [
              { term: { '@type': 'work' } },
              { range: { issued: dateRange } }
            ]
          }
        },
        {
          bool: {
            must: [
              { term: { '@type': 'grant' } },
              {
                bool: {
                  should: [
                    { range: { 'dateTimeInterval.start.dateTime': dateRange } },
                    { range: { 'dateTimeInterval.end.dateTime': dateRange } }
                  ],
                  minimum_should_match: 1
                }
              }
            ]
          }
        },
        // Experts are not date-filtered — keep them visible regardless
        { term: { '@type': 'expert' } }
      ],
      minimum_should_match: 1
    }
  };
}

/**
 * @function buildAeSearchBody
 * @description Build the full Elasticsearch request body for the ae-search index.
 * Includes BM25 query, optional KNN, post_filter for type/status/date facets,
 * and aggregations. Only @id and @type are returned in _source since full documents
 * are retrieved via mget from the dedicated indices.
 *
 * @param {Object} params parsed search parameters
 * @param {Array|Object|null} knn KNN clause(s) or null
 * @param {boolean} [globalMode=false] when true, omit post_filter so aggs see all types
 * @returns {Object} Elasticsearch request body
 */
function buildAeSearchBody(params, knn, globalMode = false) {
  const size = globalMode ? 0 : (parseInt(params.size) || 10);
  const page = globalMode ? 1 : (parseInt(params.page) || 1);

  const body = {
    size,
    from: (page - 1) * size,
    _source: ['@id', '@type'],
    track_total_hits: true,
    query: {
      bool: {
        must: [buildBm25Query(params.q)],
        filter: [{ term: { 'is-visible': true } }]
      },
    },
    // min_score : 100.0,
    aggs: buildAeSearchAggs()
  };

  if (knn) body.knn = knn;

  if (!globalMode) {
    const postMust = [];
    if (params['@type']?.length) postMust.push({ terms: { '@type': params['@type'] } });
    if (params.expert?.length) postMust.push({ terms: { 'expert_ids': params.expert } });
    if (params.status?.length) postMust.push({ terms: { status: params.status } });
    if (params.type?.length) postMust.push({ terms: { type: params.type } });
    if (params.dateFrom || params.dateTo) {
      postMust.push(buildDatePostFilter(params.dateFrom, params.dateTo));
    }
    console.log('Post-filter clauses:', JSON.stringify(postMust, null, 2));
    if (postMust.length) body.post_filter = { bool: { must: postMust } };
  }

  return body;
}

/**
 * @function processAeSearchAggs
 * @description Convert ae-search aggregation results to the format the webapp frontend expects.
 * Produces issued_years_combined, issued_years_works, issued_years_grants, grants_total,
 * and a facets object with @type, status, type, and hasAvailability counts.
 *
 * @param {Object} aggs raw Elasticsearch aggregations object
 * @returns {Object} processed aggregations
 */
function processAeSearchAggs(aggs) {
  if (!aggs) return {};

  const result = {};

  // Year histograms
  const worksBuckets = aggs.works_years?.years?.buckets ?? [];
  const grantsBuckets = aggs.grants_years?.years?.buckets ?? [];

  const combined = {};
  const worksYears = {};
  const grantsYears = {};

  for (const b of worksBuckets) {
    const key = String(b.key);
    const count = b.doc_count || 0;
    combined[key] = (combined[key] || 0) + count;
    worksYears[key] = count;
  }
  for (const b of grantsBuckets) {
    const key = String(b.key);
    const count = b.doc_count || 0;
    combined[key] = (combined[key] || 0) + count;
    grantsYears[key] = count;
  }

  result.issued_years_combined = combined;
  result.issued_years_works = worksYears;
  result.issued_years_grants = grantsYears;
  result.grants_total = grantsBuckets.reduce((sum, b) => sum + (b.doc_count || 0), 0);

  // Facets
  const facets = {};

  if (aggs.type_counts?.buckets) {
    facets['@type'] = {};
    for (const b of aggs.type_counts.buckets) facets['@type'][b.key] = b.doc_count;
  }
  if (aggs.status_counts?.counts?.buckets) {
    facets.status = {};
    for (const b of aggs.status_counts.counts.buckets) facets.status[b.key] = b.doc_count;
  }
  if (aggs.work_type_counts?.counts?.buckets) {
    facets.type = {};
    for (const b of aggs.work_type_counts.counts.buckets) facets.type[b.key] = b.doc_count;
  }
  if (aggs.availability_counts?.counts?.buckets) {
    facets.hasAvailability = {};
    for (const b of aggs.availability_counts.counts.buckets) facets.hasAvailability[b.key] = b.doc_count;
  }

  result.facets = facets;
  return result;
}

router.get(
  '/',
  public_or_is_user,
  valid_path(
    {
      description: "Returns matching search results, including the number of matching works and grants",
      parameters: ['p', 'page', 'size',
                   '@type', 'type', 'status','availability','expert','dateFrom','dateTo'],
      responses: {
        "200": openapi.response('Search'),
        "400": openapi.response('Invalid_request')
      }
    }
  ),
  valid_path_error,
  async (req, res) => {
    const params = {
      "@type" : ['expert', 'grant', 'work'],
      "q" : "",
      "size" : 10,
      "page" : 1
    };

    ["inner_hits_size", "size", "page", "q"].forEach(key => {
      if (req.query[key]) params[key] = req.query[key];
    });

    if (req.query.debug_scores === 'true') params.debug_scores = true;

    if (params.size > 100) {
      return res.status(400).json({ error: 'Size exceeds limit' });
    }

    if (req?.query.availability) params.availability = req.query.availability.split(',');
    if (req?.query.expert) params.expert = req.query.expert.split(',');
    if (req?.query.status) params.status = req.query.status.split(',');
    if (req?.query["@type"]) params["@type"] = req.query["@type"].split(',');
    if (req?.query.type) params.type = req.query.type.split(',');

    if (req?.query.dateFrom) {
      if (/^\d{4}$/.test(req.query.dateFrom)) {
        params.dateFrom = `${req.query.dateFrom}-01-01`;
      } else {
        return res.status(400).json({ error: 'Invalid dateFrom year format. Must be a 4-digit year.' });
      }
    }
    if (req?.query.dateTo) {
      if (/^\d{4}$/.test(req.query.dateTo)) {
        params.dateTo = `${req.query.dateTo}-12-31`;
      } else {
        return res.status(400).json({ error: 'Invalid dateTo year format. Must be a 4-digit year.' });
      }
    }

    if (!params.q) {
      return res.status(400).json({ error: 'Missing required query parameter "q"' });
    }

    // Validate @type values
    const validTypes = { expert: true, work: true, grant: true };
    for (const t of params['@type']) {
      if (!validTypes[t]) return res.status(400).json({ error: 'Invalid type' });
    }

    // Index alias to use (preview overrides for testing)
    const aliasName = config.elasticsearch.aliases.current;
    const searchIndex = `${config.elasticsearch.indexes.search}-${aliasName}`;
    const typeToIndex = {
      expert: req.query['previewEsIndexExperts'] || `${config.elasticsearch.indexes.experts}-${aliasName}`,
      work:   req.query['previewEsIndexWorks']   || `${config.elasticsearch.indexes.works}-${aliasName}`,
      grant:  req.query['previewEsIndexGrants']  || `${config.elasticsearch.indexes.grants}-${aliasName}`
    };

    // Build KNN clauses for ae-search (expert centroid boosted higher than works/grants)
    let knn = null;
    try {
      const ollama = new Ollama();
      const embedResp = await ollama.embed({ model: config.llm.embedModel, input: params.q });
      let vector = embedResp.embeddings[0];
      if (config.llm.embedDimension && vector.length > config.llm.embedDimension) {
        vector = vector.slice(0, config.llm.embedDimension);
      }
      const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      if (magnitude > 0) vector = vector.map(v => v / magnitude);

      const requestedTypes = params['@type'];
      const requestedExpert = params.expert ? params.expert[0] : null; // Only support single expert filter for KNN routing for now
      const baseKnn = {
        field: 'embedding',
        query_vector: vector,
        k: 200,
        num_candidates: 300,
        similarity: 0.6
      };

      const knnClauses = [];
      

      if (requestedTypes.includes('expert')) {
        knnClauses.push({
          ...baseKnn,
          boost: 600.0,
          similarity: 0.4,
          filter: { bool: { must: [
            { term: { 'is-visible': true } }, 
            { term: { '@type': 'expert' } }
          ].concat(requestedExpert ? [{ term: { '@graph.@id': requestedExpert } }] : [])  
          } }
        });
      }

      if (requestedTypes.includes('work')) {
        knnClauses.push({
          ...baseKnn,
          boost: 200.0,
          similarity: 0.1,
          filter: { bool: { must: [
            { term: { 'is-visible': true } }, 
            { term: { '@type': 'work' } }]

          } }
        });
      }

      const otherTypes = requestedTypes.filter(t => t !== 'expert' && t !== 'work');
      if (otherTypes.length) {
        knnClauses.push({
          ...baseKnn,
          boost: 100.0,
          filter: { bool: { must: [
            { term: { 'is-visible': true } }, 
            { terms: { '@type': otherTypes } }
          ].concat(requestedExpert ? [{ term: { '@graph.@id': requestedExpert } }] : [])  
          } }
        });
      }

      knn = knnClauses.length === 1 ? knnClauses[0] : knnClauses;
    } catch(embedErr) {
      console.warn('Search embedding generation failed, falling back to BM25 only:', embedErr.message);
    }

    try {
      const esClient = await Elasticsearch.initClient();

      // Main search on ae-search index; BM25-only parallel query for score debugging
      const searchBody = buildAeSearchBody(params, knn);
      if( params.debug_scores ) {
        searchBody.explain = true; // Ensure scores are tracked for debugging
      }

      const globalBody = buildAeSearchBody(params, knn, true);
      // const bm25Body = params.debug_scores ? buildAeSearchBody(params, null) : null;

      const [searchResp, globalResp, bm25Resp] = await Promise.all([
        esClient.search({ index: searchIndex, body: searchBody }),
        esClient.search({ index: searchIndex, body: globalBody })
        // bm25Body ? esClient.search({ index: searchIndex, body: bm25Body }) : Promise.resolve(null)
      ]);

      const searchResult = searchResp?.body ?? searchResp;
      const searchHits = searchResult?.hits?.hits ?? [];
      const total = searchResult?.hits?.total?.value ?? 0;
      const globalResult = globalResp?.body ?? globalResp;

      // Capture combined (BM25+KNN) scores from search hits
      // const scoreMap = new Map();
      // for (const hit of searchHits) {
      //   const id = hit._source?.['@id'];
      //   if (id) scoreMap.set(id, { combined: hit._score });
      // }

      // Capture BM25-only scores if debug mode is on
      // if (bm25Resp) {
      //   const bm25Result = bm25Resp?.body ?? bm25Resp;
      //   for (const hit of (bm25Result?.hits?.hits ?? [])) {
      //     const id = hit._source?.['@id'];
      //     if (!id) continue;
      //     const entry = scoreMap.get(id) || {};
      //     entry.bm25 = hit._score;
      //     scoreMap.set(id, entry);
      //   }
      // }

      // Group hits by type for mget routing, preserving rank order
      const hitOrder = [];
      const byType = { expert: [], work: [], grant: [] };
      for (const hit of searchHits) {
        const id = hit._source?.['@id'];
        const type = hit._source?.['@type'];
        if (id && byType[type]) {
          byType[type].push(id);
          hitOrder.push({ id, type });
        }
      }

      // mget full documents from dedicated indices in parallel
      const [expertDocs, workDocs, grantDocs] = await Promise.all([
        base.mget({ index: typeToIndex.expert, ids: byType.expert }),
        base.mget({ index: typeToIndex.work,   ids: byType.work }),
        base.mget({ index: typeToIndex.grant,  ids: byType.grant })
      ]);

      // Build id -> doc map for rank-order reassembly
      const docMap = new Map();
      for (const doc of [...expertDocs, ...workDocs, ...grantDocs]) {
        if (doc['@id']) docMap.set(doc['@id'], doc);
      }

      // Reassemble hits in original search rank order, stripping embedding vectors
      const hits = [];
      for (const { id } of hitOrder) {
        const doc = docMap.get(id);
        if (!doc) continue;
        delete doc.embedding;
        if( doc['@graph'] ) {
          doc['@graph'].forEach(node => delete node.embedding);
        }
        hits.push(doc);
      }

      // Work/grant match counts per expert (single aggregation query, BM25 only)
      const expertIds = byType.expert;
      if (expertIds.length) {
        const countResp = await esClient.search({
          index: searchIndex,
          body: {
            size: 0,
            query: {
              bool: {
                must: [buildBm25Query(params.q)],
                filter: [
                  { term: { 'is-visible': true } },
                  { terms: { '@type': ['work', 'grant'] } },
                  { terms: { expert_ids: expertIds } }
                ]
              }
            },
            aggs: {
              work_counts: {
                filter: { term: { '@type': 'work' } },
                aggs: { by_expert: { terms: { field: 'expert_ids', size: 500 } } }
              },
              grant_counts: {
                filter: { term: { '@type': 'grant' } },
                aggs: { by_expert: { terms: { field: 'expert_ids', size: 500 } } }
              }
            }
          }
        });

        const countBody = countResp?.body ?? countResp;
        const countByExpert = {};

        for (const b of countBody?.aggregations?.work_counts?.by_expert?.buckets ?? []) {
          if (!countByExpert[b.key]) countByExpert[b.key] = {};
          countByExpert[b.key].works = b.doc_count;
        }
        for (const b of countBody?.aggregations?.grant_counts?.by_expert?.buckets ?? []) {
          if (!countByExpert[b.key]) countByExpert[b.key] = {};
          countByExpert[b.key].grants = b.doc_count;
        }

        // Attach counts to expert documents in hits
        for (const doc of hits) {
          const counts = countByExpert[doc['@id']];
          if (counts) {
            doc._work_count = counts.works || 0;
            doc._grant_count = counts.grants || 0;
          }
        }
      }

      const response = {
        params,
        total,
        hits,
        aggregations: processAeSearchAggs(searchResult?.aggregations),
        global_aggregations: processAeSearchAggs(globalResult?.aggregations)
      };

      if (params.debug_scores) {
        // scores keyed by @id: { combined: BM25+KNN score, bm25: BM25-only score, knn_contribution: diff }
        // const scores = {};
        // for (const [id, s] of scoreMap) {
        //   const bm25 = s.bm25 ?? 0;
        //   scores[id] = { combined: s.combined, bm25, knn_contribution: s.combined - bm25 };
        // }
        let scores = {};
        for (const hit of searchHits) {
          const id = hit._source?.['@id'];
          if (!id) continue;
          scores[id] = { score: hit._score, explanation: hit._explanation };
        }

        delete response.aggregations; // Remove aggs from main response to reduce payload, since they don't have scores
        delete response.global_aggregations; // Remove global aggs as well for same reason
        delete response.hits;
        response.scores = scores;
      }

      res.send(response);

    } catch(err) {
      console.error('ae-search error:', err?.meta?.body || err);
      res.status(400).send('Invalid request');
    }
  });

module.exports = router;
