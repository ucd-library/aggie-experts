const express = require('express');
const swaggerJSDoc = require('swagger-jsdoc');
const logger = require('./logger.js');
const models = require('./models.js');
const config = require('./config.js')

const app = express();

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'FIN API',
    version: '1.0.0',
    description:
      'This is the Swagger documentation for FIN.',
    license: {
      name: 'Licensed Under MIT',
      url: 'https://spdx.org/licenses/MIT.html',
    },
    contact: {
      name: 'Online Strategy - UC Davis Library',
      url: 'https://library.ucdavis.edu/online-strategy/',
    },
  },
  paths: {}
};

async function init() {
  let apis = [];
  let names = await models.names();
  logger.info(`Found ${names.length} API(s)`, { names });
  for( let name of names ) {
    let {api, swagger} = await models.get(name);
    logger.info(`Found API for ${name}`, { api, swagger });
    if( !api ) continue;

    try {
      if( swagger?.paths ) {
        if( !Array.isArray(swagger.paths) ) {
          swagger.paths = Object.entries(swagger.paths).map(([key, value]) => ({ path : key, docs : value }));
        }
        swagger.paths.forEach(doc => {
          swaggerDefinition.paths[`/api/${doc.path.replace(/\/?api\/?/g, '')}`] = doc.docs;
        });
      }
      if( swagger?.components?.schemas ) {
        swaggerDefinition.components = swagger.components;
      }
      if( swagger?.openapi ) {
        swaggerDefinition.openapi = swagger.openapi;
      }
      if( swagger?.info ) {
        swaggerDefinition.info = swagger.info;
      }
      apis.push('api/'+name);
    } catch (e) {
      logger.error('Error loading swagger for '+name, e);
    }

    logger.info(`Registering api routes for ${name} at /api/${name}`);
    app.use('/'+name, api);
  }

  apis.push('api/controllers/*.js');

  const options = {
    swaggerDefinition,
    apis,
  };

  const swaggerSpec = swaggerJSDoc(options);

  app.get('/', (req, res) => {
    res.json(swaggerSpec);
  });

  return app;
}

module.exports = init;

if( require.main === module ) {
  const port = config.api.port;
  init().then(app => {
    app.listen(port, () => {
      logger.info(`API server listening on port ${port}`);
    });
  }).catch(err => {
    logger.error('Failed to start API server:', err);
    process.exit(1);
  });
}
