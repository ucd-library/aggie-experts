const express = require('express');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const spaMiddleware = require('@ucd-lib/spa-router-middleware');
const config = require('../config');
const esClient = require('@ucd-lib/fin-service-utils').esClient;

module.exports = async (app) => {

  // path to your spa assets dir
  let assetsDir = path.join(__dirname, '..', 'client', 'public');

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
        user.expertId = 'expert/'+ md5(user.preferred_username+'@ucdavis.edu');

        let esUser = await esClient.search({
          query : {
            bool: {
              must: {
                term : {
                  _id : user.expertId,
                }
              }
            }
          }
        });
        user.hasProfile = esUser.hits.hits.length > 0;

      } else {
        user = {loggedIn: false};
      }

      next({
        user,
        appRoutes : config.client.appRoutes,
        env : config.client.env,
      });
    },

    template : async (req, res, next) => {
      return next({title: 'Aggie Experts'});
    }
  });

}
