const express = require('express');
const swaggerJSDoc = require('swagger-jsdoc');
const logger = require('./logger.js');
const models = require('./models.js');


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
  for( let name of names ) {
    let {api, swagger} = await models.get(name);
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
    router.use('/'+name, api);
  }

  apis.push('api/controllers/*.js');
  
  const options = {
    swaggerDefinition,
    apis,
  };
  
  const swaggerSpec = swaggerJSDoc(options);
  
  router.get('/', (req, res) => {
    res.json(swaggerSpec);
  });

  return router;
}

module.exports = init;