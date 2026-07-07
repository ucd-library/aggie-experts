const keycloak = require('../../lib/keycloak');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const template = require('../base/template/name.js');
const {
  config,
  ExpertsKcAdminClient,
} = require('@ucd-lib/experts-commons');

let AdminClient, MIVJWKSClient;

/**
 * @function browseLetterFromName
 * @description Derive the browse letter for a name, mirroring the ES name.first
 * field logic: strip leading articles then take the first character lowercased.
 * Numeric/symbol names map to '1' (displayed as '#').
 * @param {String|Array} name raw name value from the ES _source
 * @returns {String} single lowercase letter or '1'
 */
function browseLetterFromName(name) {
  const raw = (Array.isArray(name) ? name[0] : name) || '';
  const title = raw.split('§')[0].trim();
  const sortable = title.replace(/^(The|A|An)\s+/, '');
  const first = sortable[0]?.toLowerCase() || '';
  return /^[a-z]$/.test(first) ? first : '1';
}

async function initAuth() {
  AdminClient = new ExpertsKcAdminClient();
  await AdminClient.authenticate();

  MIVJWKSClient = jwksClient({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    jwksUri: `${config.oidc.host}/realms/${config.oidc.clients.miv.realm}/protocol/openid-connect/certs`
  });
}


async function item_endpoint(router, model, subselect = (req, res, next) => next()) {
  // Express 5 path-to-regexp is stricter; avoid optional path params like '/:id?'.
  // Support both '/:id' and '/' with query param 'id'.

  router.route(
    '/:id'
  ).get(
    public_or_is_user,
    async (req, res, next) => {
      const id = req.params.id || req.query.id;

      let options = {};
      if( req.query['previewEsIndex'] ) options.previewEsIndex = req.query['previewEsIndex'];

      try {
        res.thisDoc = await model.get(id, options);
        next();
      } catch (e) {
        return res.status(404).json(`${id} resource not found`);
      }
    },
    subselect,
    (req, res) => {
      res.status(200).json(res.thisDoc);
    }
  )

  router.route(
    '/'
  ).get(
    public_or_is_user,
    async (req, res, next) => {
      const id=req.query.id;
      if( !id ) return res.status(400).json('missing id');
      try {
        res.thisDoc = await model.get(id);
        next();
      } catch (e) {
        return res.status(404).json(`${id} resource not found`);
      }
    },
    subselect,
    (req, res) => {
      res.status(200).json(res.thisDoc);
    }
  )
}

function browse_endpoint(router,model) {
  router.route(
    '/browse',
  ).get(
    public_or_is_user,
    async (req, res) => {
      try {
        await model.verify_template(template);
      } catch (err) {
        return res.status(400).send('Invalid request');
      }

      const params = {
        size: 25,
        index: model.readIndexAlias,
      };
      ["size", "page", "p", "previewEsIndex", "dateFrom", "dateTo"].forEach((key) => {
        if( key === 'previewEsIndex' && req.query[key] ) {
          params.index = req.query[key];
        } else if( req.query[key] ) {
          params[key] = req.query[key];
        }
      });

      if( req.query.dept ) params.dept = req.query.dept.split(',').filter(Boolean);
      if( req.query.status ) params.status = req.query.status.split(',').filter(Boolean);
      if( req.query.type ) params.type = req.query.type.split(',').filter(Boolean);
      if( req.query.availability ) params.availability = req.query.availability.split(',').filter(Boolean);
      if( params.dateFrom && /^\d{4}$/.test(params.dateFrom) ) params.dateFrom = `${params.dateFrom}-01-01`;
      if( params.dateTo && /^\d{4}$/.test(params.dateTo) ) params.dateTo = `${params.dateTo}-12-31`;

      if( req.query.counts === 'true' ) {
        // return aggregations without hits; optionally scoped to a letter (p param)
        // but always without status/type so all category buckets are returned
        const opts = { id: "name", params: { ...params, size: 0, categoryAggs: true } };
        delete opts.params.status;
        delete opts.params.type;
        if( opts.params.p === 'all' ) delete opts.params.p;
        try {
          const find = await model.search(opts);
          res.json(find);
        } catch (err) {
          res.status(400).json('Invalid request');
        }
        return;
      }

      if (params.p === 'all') {
        // all-results mode: strip the letter param so the template uses match_all,
        // then run a normal paginated search and annotate each hit with its letter.
        // sortNumericLast pushes # items after A-Z via a script sort in ES so the
        // ordering is correct across pages, not just within each page.
        delete params.p;
        params.sortNumericLast = true;
        params.yearAggs = true;
        const opts = { id: "name", params };
        try {
          const find = await model.search(opts);
          if( Array.isArray(find?.hits) ) {
            find.hits = find.hits.map(hit => ({ ...hit, letter: browseLetterFromName(hit.name) }));
          }
          res.send(find);
        } catch (err) {
          res.status(400).send('Invalid request');
        }
      } else if (params.p) {
        if (params.p === 'other') {
          params.p = '1';
        } else if (params.p.match(/^[a-zA-Z]/)) {
          params.p = params.p.substring(0,1);
        } else {
          params.p = '1';
        }
        params.yearAggs = true;

        const opts = {
          id: "name",
          params
        };

        try {
          const find = await model.search(opts);
          res.send(find);
        } catch (err) {
          res.status(400).send('Invalid request');
        }
      } else {
        try {
          const search_templates=[];
          ["1","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O",
           "P","Q","R","S","T","U","V","W","X","Y","Z"].forEach((letter) => {
             search_templates.push({});
             search_templates.push({
              id : "name",
              params : {
                ...params,
                p:letter,
                size:0
              }
            });
           });
          let opts = { search_templates };
          if( params.index ) opts.index = params.index;
          const finds = await model.msearch(opts);
          res.send(finds);
        } catch (err) {
          res.status(400).send('Invalid request');
        }
      }
    }
  );
}

async function fetchExpertId (req, res, next) {
  let user;
  try {
    if (req.query.email) {
      const email = req.query.email;
      user = await AdminClient.findByEmail(email);
    } else if (req.query.ucdPersonUUID) {
      const ucdPersonUUID = req.query.ucdPersonUUID;
      user = await AdminClient.findOneByAttribute(`ucdPersonUUID:${ucdPersonUUID}`);
    }
    else if (req.query.iamId) {
      const iamId = req.query.iamId;
      user = await AdminClient.findOneByAttribute(`iamId:${iamId}`);
    }
  } catch (err) {
    // console.error(err);
    return res.status(500).send({error: 'Error finding expert with ${req.query}'});
  }

  if (user && user?.attributes?.expertId) {
    const expertId = Array.isArray(user.attributes.expertId) ? user.attributes.expertId[0] : user.attributes.expertId;
    req.expertId = expertId;
    return next();
  } else {
    return res.status(404).send({error: `No expert found`});
  }
}

async function convertIds(req, res, next) {
  const ids = req.params.ids.replace('ids=', '').split(',');

  // for each id, get the expertId
  let experts = [];
  for( const id of ids ) {
    try {
      const matchedUser = await AdminClient.findOneByAttribute(id);      
      if( matchedUser && matchedUser?.attributes?.expertId ) {
        const expertId = Array.isArray(matchedUser.attributes.expertId) ? matchedUser.attributes.expertId[0] : matchedUser.attributes.expertId;
        experts.push(`expert/${expertId}`);
      }
    } catch (err) {
      console.error(`Error fetching user with ${id}`, err);
    }
  }

  req.expertIds = experts;
  return next();
}


function has_access(client) {

  return async function(req, res, next) {
    if (!req.user) {
      // Try Service Account
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Token not provided' });
      }
      try {
        // Get the public key from the JWKS endpoint
        const key = await MIVJWKSClient.getSigningKey(jwt.decode(token, { complete: true }).header.kid);
        // Verify the token's signature using the public key
        const verifiedToken = jwt.verify(token, key.getPublicKey(), { algorithms: ['RS256'] });

        // Validate issuer.
        // Only accept tokens from the expected Keycloak realm for this client
        if (verifiedToken.iss !== config.oidc.host + '/realms/' + config.oidc.clients[client]?.realm) {
          return res.status(401).json({ error: 'Invalid token issuer' });
        }

        // Validate audience
        if (verifiedToken.aud !== 'account') {
          return res.status(401).json({ error: 'Invalid token audience' });
        }

        // Validate expiration
        if (Date.now() >= verifiedToken.exp * 1000) {
          return res.status(401).json({ error: 'Token has expired' });
        }

        // Custom authorization logic
        // Implement your own logic here based on token claims
        if (! verifiedToken?.resource_access?.[client]?.roles?.includes(config.oidc.roles.serviceAccountAccess) ) {
          return res.status(403).json({ error: 'No Access Role' });
        }
        return next();
      }
      catch (error) {
        // console.error(error);
        return res.status(403).json({ error: 'Internal server error' });
      }
    } else {
      if (req.user?.resource_access?.['aggie-experts'].roles?.includes(config.oidc.roles.admin) || 
          req.user?.resource_access?.['aggie-experts'].roles?.includes(client)) {
        return next();
      }
    }
    return res.status(403).json({ error: 'Not Authorized' });
  }
}


// Custom middleware to check Content-Type
function json_only(req, res, next) {
  const contentType = req.get('Content-Type') ;
  if (contentType.startsWith('application/json') || contentType.startsWith('application/ld+json')) {
    // Content-Type is acceptable
    return next();
  } else {
    // Content-Type is not acceptable
    res.status(400).json({ error: 'Invalid Content-Type. Only application/json or application/ld+json is allowed.' });
  }
}

function public_or_is_user(req, res, next) {
  if (config.experts.is_public) {
    return next();
  }
  return is_user(req, res, next);
}

// Not exported
function is_user(req, res, next) {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  return next();
}


function user_can_edit(req, res, next) {
  let expertId = `${req.params.expertId}`;
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  if (req.user?.roles?.includes('admin')) {
    return next();
  }
  if( expertId === req?.user?.attributes?.expertId ) {
    return next();
  }

  return res.status(403).send('Not Authorized');
}

/**
 * Middleware to authorize Dagster partition operations.
 * 
 * Users can only run/query their own partition (matching their email).
 * Partition is accepted from body, query, or params.
 * 
 * @param {Object} options
 * @param {string} options.userEmailField - The field name in req.user that contains the user's email/partition (default: 'email')
 * @param {boolean} options.requirePartition - If false, skip partition-required and match checks (default: true)
 * @returns {Function} Express middleware function
 */
function dagster_can_run_partition(options = {}) {
  const {
    userEmailField = 'email',
    requirePartition = true
  } = options;

  return async (req, res, next) => {
    if( !req.user ) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if( requirePartition === false ) {
      return next();
    }

    let userPartition = req.user?.[userEmailField];
    if( !userPartition ) {
      return res.status(401).json({ error: 'User email not found in token' });
    }

    let requestedPartition = req.body?.partition || req.query?.partition || req.params?.partition;
    if( !requestedPartition ) {
      return res.status(400).json({ error: 'partition is required' });
    }

    if( requestedPartition !== userPartition ) {
      return res.status(403).json({ 
        error: `User can only access their own partition. Requested: ${requestedPartition}, User partition: ${userPartition}` 
      });
    }

    return next();
  };
}

function schema_error(err, req, res, next) {
  res.status(err.status).json({
    error: err.message,
    validation: err.validationErrors,
    schema: err.validationSchema
  })
}

// export this middleware functions
module.exports = {
  initAuth,
  browse_endpoint,
  convertIds,
  dagster_can_run_partition,
  fetchExpertId,
  has_access,
  public_or_is_user,
  item_endpoint,
  json_only,
  schema_error,
  user_can_edit,
};