const router = require('express').Router();
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const GrantModel = require('../grant/model.js');
const WorkModel = require('../work/model.js');
const utils = require('../utils.js')
const complete = require('./template/complete.js');
const base = new BaseModel();
const experts = new ExpertModel();
const grants = new GrantModel();
const works = new WorkModel();

const {config} = require('@ucd-lib/fin-service-utils');

const { openapi, public_or_is_user } = require('../middleware/index.js')

function search_valid_path(options={}) {
  const def = {
    "description": "Search of experts and grants",
    "parameters": [],
  };

  (options.parameters || []).forEach((param) => {
    def.parameters.push(openapi.parameters(param));
  });

  delete options.parameters;

  return openapi.validPath({...def, ...options});
}

function search_valid_path_error(err, req, res, next) {
  return res.status(err.status).json({
    error: err.message,
    validation: err.validationErrors,
    schema: err.validationSchema
  })
}

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(openapi);

router.get(
  '/',
  public_or_is_user,
  search_valid_path(
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
  search_valid_path_error,
  async (req, res) => {
    const params = {
      "@type":['expert','grant','work'],
      "q": "",
      "size": 10,
      "page": 1,
      index: []
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
      params.dateFrom = `${req.query.dateFrom}-01-01`;
    }
    if (req?.query.dateTo) {
      params.dateTo = `${req.query.dateTo}-12-31`;
    }
    params.hasDate = !!(params.dateFrom || params.dateTo);
    if ( ! params.q ) {
      res.status(400).json({ error: 'Missing required query parameter "q"' });
    }

    const typeToIndex = {
      expert: experts.readIndexAlias,
      grant: grants.readIndexAlias,
      work: works.readIndexAlias,
    };
    for (const t of params["@type"]) {
      const indexAlias = typeToIndex[t];
      if (!indexAlias) {
        return res.status(400).json({ error: 'Invalid type' });
      }
      if (!params.index.includes(indexAlias)) {
        params.index.push(indexAlias);
      }
    }
    opts = {
      id: complete.id,
      params
    };
    try {
      await experts.verify_template(complete);
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
        { id: complete.id,
          params: {
            ...opts.params,
            size: 0,
            index: [experts.readIndexAlias,
                    grants.readIndexAlias,
                    works.readIndexAlias]
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
          id: complete.id,
          params: {
            ...filteredParams,
            size: 0,
            index: [experts.readIndexAlias,
                    grants.readIndexAlias,
                    works.readIndexAlias]
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
