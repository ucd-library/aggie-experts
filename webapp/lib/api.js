const express = require('express');
const bodyParser = require('body-parser');
const swaggerJSDoc = require('swagger-jsdoc');
const { logger, config, SlackNotifier } = require('@ucd-lib/experts-commons');
const { initAuth } = require('../models/middleware/index.js');
const models = require('./models.js');
const keycloak = require('./keycloak.js');
const swaggerParameters = require('./swagger/parameters.json');
const swaggerSchemas = require('./swagger/schemas.json');
const swaggerResponses = require('./swagger/responses.json');
const swaggerRequestBodies = require('./swagger/requestBodies.json');

const app = express();

app.use(keycloak.setUser);

const swaggerDefinition = {
  openapi: '3.0.0',
  "info": {
    "title": "Aggie Experts API",
    "version": "5.0", // TODO pull from config file for version?
    "description": "Allows for the retrieval of expert information.",
    "termsOfService": "https://experts.ucdavis.edu/termsofuse",
    "contact": {
      "email": "experts@ucdavis.edu"
    },
    "license": {
      "name": "Apache 2.0",
      "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
    }
  },
  "servers": [
    {
      "url": "http://experts.ucdavis.edu/api"
    }
  ],
  "tags": [
    {
      "name": "expert",
      "description": "Expert Information"
    },
  ],
  components: {
    parameters: swaggerParameters,
    schemas: swaggerSchemas,
    responses: swaggerResponses,
    requestBodies: swaggerRequestBodies
  },
  paths: {}
};

async function init() {
  let apis = [];
  let names = await models.names();
  logger.info(`Found ${names.length} API(s)`, { names });
  for( let name of names ) {
    let {api, swagger} = await models.get(name);
    logger.info(`Found API for ${name}`, { api: !!api });
    if( !api ) continue;

    try {
      if( swagger?.paths ) {
        if( !Array.isArray(swagger.paths) ) {
          logger.info('adding paths for', name, Object.keys(swagger.paths));
          swagger.paths = Object.entries(swagger.paths).map(([key, value]) => ({ path : key, docs : value }));
        }
        swagger.paths.forEach(doc => {
          logger.info('adding paths for', name, Object.keys(doc.docs));
          let docs = Object.fromEntries(
            Object.entries(doc.docs).map(([method, operation]) => {
              if( !operation ) return [method, operation];
              return [method, {...operation, tags: ['expert']}];
            })
          );
          swaggerDefinition.paths[`/api/${doc.path.replace(/\/?api\/?/g, '')}`] = docs;
        });
      }
      apis.push('api/'+name);
    } catch (e) {
      logger.error('Error loading swagger for '+name, e);
    }

    logger.info(`Registering api routes for ${name} at /api/${name}`);
    app.use('/'+name, bodyParser.json(), api);
  }

  const options = {
    swaggerDefinition,
    apis,
  };

  const swaggerSpec = swaggerJSDoc(options);

  app.get('/', (req, res) => {
    const spec = req.user ? swaggerSpec : filterPrivateOps(swaggerSpec);
    res.json(spec);
  });

  await initAuth();

  if (process.env.SLACK_WEBHOOK_URL) {
    await SlackNotifier.init(process.env.SLACK_WEBHOOK_URL);
  } else {
    logger.warn('SLACK_WEBHOOK_URL not set, Slack notifications disabled');
  }

  return app;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

function collectRefs(obj, refs = new Set()) {
  if (!obj || typeof obj !== 'object') return refs;
  if (Array.isArray(obj)) {
    obj.forEach(item => collectRefs(item, refs));
    return refs;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      refs.add(value);
    } else {
      collectRefs(value, refs);
    }
  }
  return refs;
}

function filterPrivateOps(spec) {
  const clone = JSON.parse(JSON.stringify(spec));

  for (const [path, pathItem] of Object.entries(clone.paths || {})) {
    for (const method of HTTP_METHODS) {
      if (pathItem[method]?.['x-private']) {
        delete pathItem[method];
      }
    }
    const hasOps = HTTP_METHODS.some(m => pathItem[m]);
    if (!hasOps) {
      delete clone.paths[path];
    }
  }

  // collect refs from paths → prune parameters, responses, requestBodies
  const pathRefs = collectRefs(clone.paths);
  const firstPassTypes = ['parameters', 'responses', 'requestBodies'];
  for (const type of firstPassTypes) {
    if (!clone.components?.[type]) continue;
    for (const key of Object.keys(clone.components[type])) {
      if (!pathRefs.has(`#/components/${type}/${key}`)) {
        delete clone.components[type][key];
      }
    }
  }

  const componentRefs = collectRefs(clone.components);
  if (clone.components?.schemas) {
    for (const key of Object.keys(clone.components.schemas)) {
      if (!componentRefs.has(`#/components/schemas/${key}`)) {
        delete clone.components.schemas[key];
      }
    }
  }

  return clone;
}

init().then(app => {
  app.listen(config.api.port, () => {
    logger.info(`API server listening on port ${config.api.port}`);
  });
}).catch(err => {
  logger.error('Error initializing API', err);
  process.exit(1);
});
