const express = require('express');
const path = require('path');
const fs = require('fs');
const spaMiddleware = require('@ucd-lib/spa-router-middleware');
const config = require('../config');

module.exports = async (app) => {

  // path to your spa assets dir
  let assetsDir = path.join(__dirname, '..', 'client', 'public');

  // make sure we are logged in
  app.all('/', (req, res, next) => {
    let user = req.get('x-fin-user');
    if( !user || !user['preferred_username'] ) {
      res.sendFile(assetsDir + '/login.html');
      return;
    }

    next();
  });

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
      next({
        user : {},
        appRoutes : config.client.appRoutes,
        env : config.client.env,
      });
    },

    template : (req, res, next) => {
      return next({title: 'Aggie Experts'});
    }
  });

}
