const router = require('express').Router();
const {config, dataModels, logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');
// const { logger } = require('@ucd-lib/fin-service-utils');
const model= new ExpertModel();

const openapi = require('@wesleytodd/openapi')

function expert_uri_from_path(path) {
  const id=[model.id,decodeURIComponent(path).split('/').slice(1,2)].join('/');
  return id;
}

function user_can_edit(req, res, next) {
  let id = expert_uri_from_path(req.path);
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  if ( req.user?.roles?.includes('admin')) {
    return next();
  }

  if( id === req.user.expertId ) {
    return next();
  }

  return res.status(403).send('Not Authorized');
}

// Custom middleware to check Content-Type
function json_only(req, res, next) {
  const contentType = req.get('Content-Type');
  if (contentType === 'application/json' || contentType === 'application/ld+json') {
    // Content-Type is acceptable
    return next();
  } else {
    // Content-Type is not acceptable
    res.status(400).json({ error: 'Invalid Content-Type. Only application/json or application/ld+json is allowed.' });
  }
}

function sanitize(req, res, next) {
  logger.info({function:'sanitize'}, JSON.stringify(req.query));
  let id = expert_uri_from_path(req.path);
  if ('no-sanitize' in req.query) {
      user_can_edit(req, res, next);
  } else {
    try {
      res.thisDoc = model.sanitize(res.thisDoc);
      next();
    } catch (e) {
      res.status(e.status || 500).json({error:e.message});
    }
  }
}

const oapi = openapi({
  openapi: '3.0.3',
  info: {
    title: 'Express',
    description: 'The Experts API specifies updates to a particular expert. Publically available API endpoints can be used for access to an experts data.  The permissions of current user allow additional access to the data.',
    version: '1.0.0',
    termsOfService: 'http://swagger.io/terms/',
    contact: {
      email: 'aggie-experts@ucdavis.edu'
    },
    license: {
      name: 'Apache 2.0',
      url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
    },
    version: config.version,
  },
  servers: [
    {
      url: `${config.host}/api/expert`
    }
  ],
  tags: [
    {
      name: 'expert',
      description: 'Expert Information'
    }
  ]
})

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(oapi)

router.route(
  '/[a-zA-Z0-9]+/ark\:\/87287\/d7mh2m\/relationship\/[0-9]+'
).get(
  user_can_edit,
  async (req, res, next) => {
    //    res.status(200).json(JSON.stringify(req));
    logger.info({function:"GET :expert/ark:/87287/d7mh2m/relationship/:id"},`req.path=${req.path}`);
    let id = decodeURIComponent(req.path).replace(/^\/[a-zA-Z0-9]+\//,'');
  logger.info({function:"GET :expert/ark:/87287/d7mh2m/relationship/:id"},`req.path=${req.path} id=${id}`);
    try {
      const authorship_model = await model.get_model('authorship');
      let opts = {
        admin : req.query.admin ? true : false,
      }
      res.thisDoc = await authorship_model.get(id, opts);
      logger.info({function:'get'},JSON.stringify(res.thisDoc));
      return next();
    } catch(e) {
     res.status(404).json(`${id} from ${req.path} HELP ${e.message}`);
    }
  },
  async (req, res, next) => {
   res.status(200).json(res.thisDoc);
  }
).patch(
  user_can_edit,
  json_only,
  async (req, res, next) => {
    let expertId=expert_uri_from_path(req.path);
    let data = req.body;

    try {
      let resp;
      let role_model;
      if( data.grant ) {
        role_model = await model.get_model('grant_role');
      } else {
        role_model = await model.get_model('authorship');
      }
      patched=await role_model.patch(data,expertId);
      res.status(204).json();
//      res.status(200).json({status: 'ok'});
    } catch(e) {
      next(e);
    }
  }
).delete(
  user_can_edit,
  async (req, res, next) => {
    logger.info(`DELETE ${req.url}`);

    try {
      let expertId = expert_uri_from_path(req.path);
      let id = decodeURIComponent(req.path).replace(/^\/[a-zA-Z0-9]+\//,'');

      const authorshipModel = await model.get_model('authorship');
      await authorshipModel.delete(id, expertId);
      res.status(200).json({status: "ok"});
    } catch(e) {
      next(e);
    }
  }
);


// this path is used instead of the defined version in the defaultEsApiGenerator
router.route(
  '/:expertId'
).get(
  oapi.path(
    {
      "description": "Get an expert by id",
      "parameters": [
        {
          "in": "path",
          "name": "expertId",
          "description": "The id of the expert to get",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "The expert",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Expert"
              }
            }
          }
        },
        "404": {
          "description": "Expert not found"
        }
      }
    }
  ),
  async (req, res, next) => {
    console.log(`expert ${req.params.expertId}`);
    let id = model.id+'/'+req.params.expertId;
     try {
      let opts = {
        admin: req.query.admin ? true : false,
      }
      res.thisDoc = await model.get(id, opts);
      next();
    } catch (e) {
      return res.status(404).json(`${req.path} resource not found`);
    }
  },
  sanitize, // Remove the graph nodes that are not visible
  (req, res) => {
    res.status(200).json(res.thisDoc);
  }
).patch(
  user_can_edit,
  json_only,
  async (req, res, next) => {
    let id = decodeURIComponent(req.path).replace(/^\//, '');
    let data = req.body;
    try {
      let resp;
      patched=await model.patch(data,id);
      res.status(204).json();
    } catch(e) {
      next(e);
    }
  }
).delete(
  user_can_edit,
  async (req, res, next) => {
    try {
      let id = decodeURIComponent(req.path).replace(/^\//, '');
      await model.delete(id);
      res.status(204).json({status: "ok"});
    } catch(e) {
      next(e);
    }
  }
);

module.exports = router;
