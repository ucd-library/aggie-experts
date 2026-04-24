const express = require('express');
const bodyParser = require('body-parser');
const swaggerJSDoc = require('swagger-jsdoc');
const { logger, config } = require('@ucd-lib/experts-commons');
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
      "url": "http://experts.ucdavis.edu/api/sitefarm"
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
          console.log('adding paths for', name, Object.keys(swagger.paths));
          swagger.paths = Object.entries(swagger.paths).map(([key, value]) => ({ path : key, docs : value }));
        }
        swagger.paths.forEach(doc => {
          console.log('adding paths for', name, Object.keys(doc.docs));
          swaggerDefinition.paths[`/api/${doc.path.replace(/\/?api\/?/g, '')}`] = doc.docs;
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
    res.json(swaggerSpec);
  });

  await initAuth();

  return app;
}

init().then(app => {
  app.listen(config.api.port, () => {
    logger.info(`API server listening on port ${config.api.port}`);
  });
}).catch(err => {
  logger.error('Error initializing API', err);
  process.exit(1);
});
