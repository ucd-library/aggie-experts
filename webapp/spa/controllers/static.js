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
const getFaqJsonLd = require('../models/faq-jsonld.js');
const getFooterJsonLd = require('../models/footer-jsonld.js');

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
      let pageJsonLd = '';
      let urlParts = req.originalUrl.split('/').filter(p => p ? true : false);

      let workId, grantId, expertId;
      let workRegex = /^\/work\/.+\/publication\/[a-zA-Z0-9-]+(?!\.[a-zA-Z]+)$/;
      let grantRegex = /^\/grant\/.+\/grant\/[a-zA-Z0-9-]+(?!\.[a-zA-Z]+)$/;
      let expertRegex = /^\/expert\/[^.]+$/;
      let faqRegex = /^\/faq(?!\.[a-zA-Z]+)$/;

      let isWork = req.originalUrl.match(workRegex);
      let isGrant = req.originalUrl.match(grantRegex)
      let isExpert = req.originalUrl.match(expertRegex);
      let isFaq = req.originalUrl.match(faqRegex);

      try {
        if( isWork ) {
          workId = urlParts.slice(1).join('/').split('?')[0];
          pageJsonLd = await works.model.seo(workId);
        } else if( isGrant ) {
          grantId = urlParts.slice(1).join('/').split('?')[0];
          pageJsonLd = await grants.model.seo(grantId);
        } else if( isExpert ) {
          expertId = 'expert/' + urlParts[1].split('?')[0];
          pageJsonLd = await experts.model.seo(expertId);
        } else if( isFaq ) {
          pageJsonLd = await getFaqJsonLd();
        }
      } catch(e) {
        // ignore and let client handle 404 if needed
      }

      const footerJsonLd = getFooterJsonLd();
      const jsonld = mergeJsonLd([footerJsonLd, pageJsonLd]);

      return next({title: 'Aggie Experts', gaId: config.client.gaId, jsonld, jsBundleHash});
    }
  });

  function mergeJsonLd(jsonLdSources=[]) {
    const graph = [];
    const dedupeSet = new Set();

    jsonLdSources
      .filter(Boolean)
      .forEach(source => {
        const nodes = getJsonLdNodes(source);

        nodes.forEach(node => {
          const dedupeKey = getJsonLdNodeKey(node);
          if( dedupeSet.has(dedupeKey) ) return;

          dedupeSet.add(dedupeKey);
          graph.push(node);
        });
      });

    if( !graph.length ) return '';

    return JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph
    }).replace(/</g, '\\u003c');
  }

  function getJsonLdNodes(source) {
    try {
      const value = typeof source === 'string' ? JSON.parse(source) : source;
      if( !value || typeof value !== 'object' ) return [];

      if( Array.isArray(value['@graph']) ) return value['@graph'];
      if( value['@type'] ) return [value];

      return [];
    } catch (e) {
      return [];
    }
  }

  function getJsonLdNodeKey(node) {
    if( node?.['@id'] ) return `id:${node['@id']}`;
    if( node?.['@type'] ) return `type:${node['@type']}:${JSON.stringify(node)}`;

    return `node:${JSON.stringify(node)}`;
  }

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
