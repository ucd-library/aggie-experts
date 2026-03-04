const { config, logger } = require('@ucd-lib/experts-commons');
const fs = require('fs-extra');
const path = require('path');
const YAML = require('yaml');
const swaggerJsdoc = require('swagger-jsdoc');

/**
 * @class FinModelLoader
 * @description dynamically load Fin models from disk
 */
class FinModelLoader {

  constructor() {
    this.models = null;
  }

  /**
   * @method load
   * @description load all models.  models might (and often do) use
   * the service utils library, so this call ALWAYS needs to be async.
   */
  load() {
    if( this.models ) return;

    if( !fs.existsSync(path.join(config.models.rootDir, 'index.js')) ) {
      logger.warn('No models found at: '+config.models.rootDir);
      this.models = {};
      return;
    }

    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          this.models = require(config.models.rootDir);
          resolve();
        } catch(e) {
          reject(e);
        }
      });
    });
  }

  /**
   * @method names
   * @description return list of all model names
   *
   * @returns {Promise<Array>}
   */
  async names() {
    await this.load();
    return Object.keys(this.models);
  }


  /**
   * @method get
   * @description return a model
   *
   * @param {String} model name of model
   * @returns
   */
  async get(model) {
    await this.load();

    if( !this.models[model] ) {
      throw new Error('Unknown model: '+model);
    }

    model = this.models[model];

    // load in swagger base file
    let extensions = ['json', 'yaml', 'yml'];
    let definition = {
      openapi: '3.0.0',
      info: {
        title: 'FIN API',
        version: '1.0.0',
        description:
          'This is the Swagger documentation for FIN.',
        license: {
          name: 'Licensed Under MIT',
          url: 'https://spdx.org/licenses/MIT.html'
        },
        contact: {
          name: 'Online Strategy - UC Davis Library',
          url: 'https://library.ucdavis.edu/online-strategy/'
        },
      }
    };

    let swaggerBase = definition;

    for( let ext of extensions ) {
      let filePath = path.join(config.models.rootDir, `swagger-spec.${ext}`);
      if( fs.existsSync(filePath) ) {
        swaggerBase = fs.readFileSync(filePath, 'utf8');
        if( ext.match(/yaml|yml$/) ) {
          swaggerBase = Object.assign(definition, YAML.parse(swaggerBase));
        } else {
          swaggerBase = Object.assign(definition, JSON.parse(swaggerBase));
        }
        break;
      }
    }

    // combine swagger base with model swagger
    if( typeof model.swagger === 'string' ) {
      let isJsDoc = model.swagger.trim().toLowerCase() === 'jsdoc';
      if( isJsDoc ) model.swagger = 'api.js';

      let swaggerPath = path.join(config.models.rootDir, model.model.id,  model.swagger);
      if( !fs.existsSync(swaggerPath) ) {
        throw new Error('Swagger file not found: '+swaggerPath);
      }

      let swagger = {};
      if( path.parse(swaggerPath).ext.match(/\.json$|\.yaml|\.yml$/) ) {
        model.swagger = fs.readFileSync(swaggerPath, 'utf8');
        if( path.parse(swaggerPath).ext.match(/\.yaml|\.yml$/) ) {
          swagger = YAML.parse(model.swagger);
        } else {
          swagger = JSON.parse(model.swagger);
        }

        // merge swagger with swaggerBase
        if( !Array.isArray(swagger.paths) ) {
          swagger.paths = Object.entries((swagger.paths || {})).map(([key, value]) => ({ path : key, docs : value }));
        }
        if( !Array.isArray(swaggerBase.paths) ) {
          swaggerBase.paths = Object.entries((swaggerBase.paths || {})).map(([key, value]) => ({ path : key, docs : value }));
        }

        swagger.paths.forEach(path => {
          let baseMatch = swaggerBase.paths.filter(sb => sb.path === path.path)[0];

          if( baseMatch ) {
            baseMatch.docs = path.docs;
          } else {
            swaggerBase.paths.push({
              path : path.path,
              docs : path.docs
            });
          }
        });

        if( !swaggerBase.tags ) swaggerBase.tags = [];
        if( swagger?.tags ) {
          swaggerBase.tags = swaggerBase.tags.concat(swagger.tags);
        }

        if( !swaggerBase.info ) swaggerBase.info = {};
        if( swagger?.info ) {
          swaggerBase.info = Object.assign({}, swaggerBase.info, swagger.info);
        }

        if( !swaggerBase.openapi ) swaggerBase.openapi = '';
        if( swagger?.openapi ) {
          swaggerBase.openapi = swagger.openapi;
        }

        if( !swaggerBase.components ) swaggerBase.components = {};

        if (swagger?.components?.schemas) {
          swaggerBase.components.schemas = Object.assign({}, swaggerBase.components.schemas, swagger.components.schemas);
        }

        if (swagger?.components?.parameters) {
          swaggerBase.components.parameters = Object.assign({}, swaggerBase.components.parameters, swagger.components.parameters);
        }

        if (swagger?.components?.responses) {
          swaggerBase.components.responses = Object.assign({}, swaggerBase.components.responses, swagger.components.responses);
        }

        if (swagger?.components?.requestBodies) {
          swaggerBase.components.requestBodies = Object.assign({}, swaggerBase.components.requestBodies, swagger.components.requestBodies);
        }

        model.swagger = swaggerBase;

      } else if( isJsDoc ) {
        // this returns jsdoc spec in api.js
        model.swagger = swaggerJsdoc({
          definition: swaggerBase,
          apis : [swaggerPath]
        });
        if( typeof model.swagger === 'string' ) {
          model.swagger = YAML.parse(model.swagger);
        }
      }
    }

    return model;
  }

}

module.exports = new FinModelLoader();
