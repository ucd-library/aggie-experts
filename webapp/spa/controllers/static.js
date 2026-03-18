const path = require('path');
const fs = require('fs');
const spaMiddleware = require('@ucd-lib/spa-router-middleware');
const config = require('../config');
const esClient = require('../../lib/es-client.js');
const { config : commonsConfig, logger } = require('@ucd-lib/experts-commons');
const crypto = require('crypto');

// for seo
let experts = require('../../models/expert/index.js');
let works = require('../../models/work/index.js');
let grants = require('../../models/grant/index.js');

let jsBundleHash = '';

module.exports = async (app) => {

  // path to your spa assets dir
  let assetsDir = path.join(__dirname, '..', 'client', config.client.assets);
  logger.info('SPA assets directory', assetsDir);

  loadJsBundleHash(assetsDir);

  /**
   * Setup SPA app routes
   */
  spaMiddleware({
    // pass the express app
    app,

    // pass the file you want to use
    htmlFile : path.join(assetsDir, 'index.html'),

    // are we serving from host root (/)?
    isRoot : true,

    // array of root paths.  ie appRoutes = ['foo', 'bar'] to server /foo/* /bar/*
    appRoutes : config.client.appRoutes,

    // options for express.static(dir, opts)
    static : {
      dir : assetsDir,
      // opts : {}  // additional opts for express.static
    },

    // do you want to manually handle 404 for requests to unknown resources
    // this lets you render your own 404 page using the index.html
    enable404 : true,

    getConfig : async (req, res, next) => {
      let user = req.user;

      if( user ) {
        if( !user.roles ) user.roles = [];
        if( user.roles.includes('admin') ) user.admin = true;
        user.loggedIn = true;
        if( user.attributes?.expertId ) user.expertId = 'expert/'+ user.attributes.expertId;

        try {
          const esResult = await esClient.get(
            {
              ...{
                index: 'experts-'+commonsConfig.elasticsearch.aliases.current,
                id: user.expertId,
                _source: false
              }
            }
          )
          user.hasProfile = esResult.found;

        } catch (e) {
          user.hasProfile = false;
        }

      } else {
        user = {loggedIn: false};
      }

      next({
        user,
        appRoutes : config.client.appRoutes,
        dagster : config.client.dagster,
        env : config.client.env,
        enableGA4Stats : config.client.enableGA4Stats,
        gaId : config.client.gaId,
        logger : config.client.logger,
        esAliases : commonsConfig.elasticsearch.aliases,
        buildInfo : commonsConfig.buildInfo,
        jsBundleHash,
      });
    },

    template : async (req, res, next) => {
      let jsonld = '';
      let urlParts = req.originalUrl.split('/').filter(p => p ? true : false);

      let workId, grantId, expertId;
      let workRegex = /^\/work\/.+\/publication\/[a-zA-Z0-9-]+(?!\.[a-zA-Z]+)$/;
      let grantRegex = /^\/grant\/.+\/grant\/[a-zA-Z0-9-]+(?!\.[a-zA-Z]+)$/;
      let expertRegex = /^\/expert\/[^.]+$/;

      let isWork = req.originalUrl.match(workRegex);
      let isGrant = req.originalUrl.match(grantRegex)
      let isExpert = req.originalUrl.match(expertRegex);

      try {
        if( isWork ) {
          workId = urlParts.slice(1).join('/').split('?')[0];
          // might remove everything but work/grant, like no relationships
          jsonld = await works.model.seo(workId);
        } else if( isGrant ) {
          grantId = urlParts.slice(1).join('/').split('?')[0];

          // might remove everything but work/grant, like no relationships
          jsonld = await grants.model.seo(grantId);
        } else if( isExpert ) {
          expertId = 'expert/' + urlParts[1].split('?')[0];

          // might have to see if too much info (might remove vcard stuff, maybe modify types)
          jsonld = await experts.model.seo(expertId);
        }
      } catch(e) {
        // ignore and let client handle 404 if needed
      }

      return next({title: 'Aggie Experts', gaId: config.client.gaId, jsonld, jsBundleHash});
    }
  });

  function loadJsBundleHash(assetsDir) {
    let env = config.client.env.CLIENT_ENV;
    let hashFile = path.join(assetsDir, 'js', 'bundle.js');
    let fileExists = fs.existsSync(hashFile);

    if( env === 'production' && !fileExists ) {
      logger.error('JS bundle file not found for production environment. Expected at: '+hashFile);
    } else if( fileExists ) {
      const fileBuffer = fs.readFileSync(hashFile);      
      jsBundleHash = crypto.createHash('sha256')
        .update(fileBuffer)
        .digest('hex')
        .toString().substring(0, 8);
      logger.info('Loaded js bundle hash: '+jsBundleHash);

    } else {
      logger.warn('JS bundle file not found. Will retry in 5 seconds. Expected at: '+hashFile);
      setTimeout(() => {
        loadJsBundleHash(assetsDir);
      }, 5000);
    }
  }

}
