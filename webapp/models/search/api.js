const router = require('express').Router();
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const GrantModel = require('../grant/model.js');
const WorkModel = require('../work/model.js');
// const utils = require('../utils.js')
const {Elasticsearch, Ollama, config} = require('@ucd-lib/experts-commons');
const base = new BaseModel();
const experts = new ExpertModel();
const grants = new GrantModel();
const works = new WorkModel();

// const {config} = require('@ucd-lib/fin-service-utils');

const { openapi, public_or_is_user, valid_path, valid_path_error } = require('../middleware/index.js')

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
// router.use(openapi);

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
      "page" : 1,
      index : []
    };

    ["p","inner_hits_size","size","page","q"].forEach((key) => {
      if (req.query[key]) { params[key] = req.query[key]; }
    });

    // if the user is not logged in, we need to set the default
    if (params.size > 100) {
      res.status(400).json({ error: 'Size exceeds limit' });
    }

    if (req?.query.availability) {
      params.availability = req.query.availability.split(',');
    }
    if (req?.query.expert) {
      params.expert = req.query.expert.split(',');
    }
    if (req?.query.status) {
      params.status = req.query.status.split(',');
    }
    if (req?.query["@type"]) {
      params["@type"] = req.query["@type"].split(',');
    }
    if (req?.query.type) {
      params.type = req.query.type.split(',');
    }
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
    params.hasDate = !!(params.dateFrom || params.dateTo);
    if ( ! params.q ) {
      res.status(400).json({ error: 'Missing required query parameter "q"' });
    }

    // Generate embedding for KNN hybrid search. Non-fatal: if Ollama is unavailable
    // the search falls back to BM25 only. The vector is passed as opts.knn directly
    // to BaseModel.search (not through the Mustache template) to avoid the 1MB
    // Mustache script result size limit.
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

      const filterMust = [
        { term: { 'is-visible': true } },
        { terms: { '@type': params['@type'] || ['expert', 'grant', 'work'] } }
      ];
      if (params.status) filterMust.push({ terms: { status: params.status } });
      if (params.type)   filterMust.push({ terms: { type: params.type } });

      knn = {
        field: 'embedding',
        query_vector: vector,
        k: 100,
        num_candidates: 200,
        boost: 100.0,
        // Only apply KNN boost to results with at least this dot-product similarity
        // (0.0–1.0 for L2-normalized vectors). Candidates below this threshold are
        // excluded from KNN scoring entirely and fall back to BM25 alone.
        similarity: 0.5,
        filter: { bool: { must: filterMust } }
      };
    } catch(embedErr) {
      console.warn('Search embedding generation failed, falling back to BM25 only:', embedErr.message);
    }

    let typeToIndex = {
      expert: req.query['previewEsIndexExperts'] || experts.readIndexAlias,
      grant: req.query['previewEsIndexGrants'] || grants.readIndexAlias,
      work: req.query['previewEsIndexWorks'] || works.readIndexAlias,
    };
    // Validate @type values but always search all indices (post_filter will handle @type filtering)
    if (params["@type"]) {
      for (const t of params["@type"]) {
        if (!typeToIndex[t]) {
          return res.status(400).json({ error: 'Invalid type' });
        }
      }
    }
    // Always include all indices so aggregations see all document types
    params.index.push(typeToIndex.expert);
    params.index.push(typeToIndex.grant);
    params.index.push(typeToIndex.work);
    // Remove duplicates
    params.index = [...new Set(params.index)];

    const templateKey = config.elasticsearch.searchImplementation === 'imperative'
      ? 'complete-imperative'
      : 'complete';
    let searchTemplate = Elasticsearch.searchTemplates[templateKey];
    let opts = {
      id: searchTemplate.id,
      buildQuery: searchTemplate.buildQuery,
      params,
      knn
    };

    try {
      await experts.verify_template(searchTemplate);
      const find = await base.search(opts);

      // Capture type/status filters before deletion
      const filteredType = req?.query.type ? req.query.type.split(',') : null;
      const filteredStatus = req?.query.status ? req.query.status.split(',') : null;

      // Now remove type filters and date filters for global aggregations
      delete params["@type"];
      delete params.status;
      delete params.type;
      delete params.dateFrom;
      delete params.dateTo;
      delete params.hasDate;

      const global = await base.search(
        { id: searchTemplate.id,
          knn,
          params: {
            ...opts.params,
            size: 0,
            index: Object.values(typeToIndex)
          }
        });
      find.global_aggregations = global.aggregations;

      // If type or status filters were applied, get year-by-year breakdown for that subfilter
      if (filteredType || filteredStatus) {
        const filteredParams = { ...opts.params };
        delete filteredParams.dateFrom;
        delete filteredParams.dateTo;
        delete filteredParams.hasDate;
        if (filteredType) filteredParams.type = filteredType;
        if (filteredStatus) filteredParams.status = filteredStatus;

        const filtered = await base.search({
          id: searchTemplate.id,
          knn,
          params: {
            ...filteredParams,
            size: 0,
            index: [typeToIndex.expert,
                    typeToIndex.grant,
                    typeToIndex.work]
          }
        });

        // Add filtered year aggregations with descriptive keys,
        // zero-filling to the full global combined year range so min/max match full histogram
        const globalCombined = global?.aggregations?.issued_years_combined || {};
        const globalYearKeys = Object.keys(globalCombined);

        const filteredCombined = filtered?.aggregations?.issued_years_combined || {};
        const zeroFilled = (sourceMap) => {
          if (!globalYearKeys.length) return sourceMap; // fallback if global is empty
          const filled = {};
          for (const y of globalYearKeys) {
            const v = sourceMap?.[y];
            filled[y] = (typeof v === 'number') ? v : 0;
          }
          return filled;
        };

        if (filteredType && filteredCombined) {
          find.global_aggregations[`issued_years_type_${filteredType.join('_')}`] = zeroFilled(filteredCombined);
        }
        if (filteredStatus && filteredCombined) {
          find.global_aggregations[`issued_years_status_${filteredStatus.join('_')}`] = zeroFilled(filteredCombined);
        }
      }

      res.send(find);
    } catch (err) {
      res.status(400).send('Invalid request');
    }
  });

module.exports = router;
