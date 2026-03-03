const express = require('express');
const bodyParser = require('body-parser');
// NOTE: swagger-jsdoc based generation is currently disabled.
// Express 5 + the mixed swagger/openapi approaches in this repo make the generated
// doc misleading (empty paths/components). We'll serve a simple index instead.
// const swaggerJSDoc = require('swagger-jsdoc');
const logger = require('./logger.js');
const models = require('./models.js');
const config = require('./config.js')
const keycloak = require('./keycloak.js');

const app = express();

app.use(keycloak.setUser);

// const swaggerDefinition = {
//   openapi: '3.0.0',
//   info: {
//     title: 'FIN API',
//     version: '1.0.0',
//     description:
//       'This is the Swagger documentation for FIN.',
//     license: {
//       name: 'Licensed Under MIT',
//       url: 'https://spdx.org/licenses/MIT.html',
//     },
//     contact: {
//       name: 'Online Strategy - UC Davis Library',
//       url: 'https://library.ucdavis.edu/online-strategy/',
//     },
//   },
//   paths: {}
// };

async function init() {
  // let apis = [];
  let names = await models.names();
  logger.info(`Found ${names.length} API(s)`, { names });
  for( let name of names ) {
    let {api/*, swagger*/} = await models.get(name);
    logger.info(`Found API for ${name}`, { api: !!api });
    if( !api ) continue;

    // try {
    //   if( swagger?.paths ) {
    //     if( !Array.isArray(swagger.paths) ) {
    //       swagger.paths = Object.entries(swagger.paths).map(([key, value]) => ({ path : key, docs : value }));
    //     }
    //     swagger.paths.forEach(doc => {
    //       swaggerDefinition.paths[`/api/${doc.path.replace(/\/?api\/?/g, '')}`] = doc.docs;
    //     });
    //   }
    //   if( swagger?.components?.schemas ) {
    //     swaggerDefinition.components = swagger.components;
    //   }
    //   if( swagger?.openapi ) {
    //     swaggerDefinition.openapi = swagger.openapi;
    //   }
    //   if( swagger?.info ) {
    //     swaggerDefinition.info = swagger.info;
    //   }
    //   apis.push('api/'+name);
    // } catch (e) {
    //   logger.error('Error loading swagger for '+name, e);
    // }

    logger.info(`Registering api routes for ${name} at /api/${name}`);
    app.use('/'+name, bodyParser.json(), api);
  }

  // const options = {
  //   swaggerDefinition,
  //   apis,
  // };

  // const swaggerSpec = swaggerJSDoc(options);

  // app.get('/', (req, res) => {
  //   res.json(swaggerSpec);
  // });
  
  // API index
  app.get('/', async (req, res) => {
    // Re-fetch names to ensure we reflect what's enabled
    const names = await models.names();

    const docs = {
      message: 'Aggie Experts API index',
      openapi: {
        expert: '/api/expert/openapi.json',
        sitefarm: '/api/sitefarm/openapi.json',
        miv: '/api/miv/openapi.json'
      },
      apis: names.map(n => `/api/${n}`)
    };

    res.json(docs);
  });

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
