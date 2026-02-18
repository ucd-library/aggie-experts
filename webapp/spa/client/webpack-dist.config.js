const path = require('path');
const webpack = require('webpack');

let config = require('@ucd-lib/cork-app-build').dist({
    // root directory, all paths below will be relative to root
    root : __dirname,
    entry : 'public/index.js',
    // folder where bundle.js and ie-bundle.js will be written
    dist : 'dist/js',
    preview : 'public/js',
    clientModules : 'public/node_modules'
  });

  if( !Array.isArray(config) ) config = [config];
    
  config.forEach(conf => {
    conf.output.publicPath = '/js/';
    
    // Replace harvest config.js with browser stub to avoid bundling Node.js dependencies
    if( !conf.plugins ) conf.plugins = [];
    conf.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /harvest\/lib\/config\.js/,
        path.resolve(__dirname, 'public/harvest-stubs/config.js')
      )
    );
  });

  // optionaly you can run:
  // require('@ucd-lib/cork-app-build').watch(config, true)
  // Adding the second flag will generate a ie build as well as a modern
  // build when in development.  Note this slows down the build process.

  module.exports = config;
