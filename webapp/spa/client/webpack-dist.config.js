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

    // Ignore Node-only modules pulled in by harvest/lib/config.js when bundling for browser
    if( !conf.resolve ) conf.resolve = {};
    conf.resolve.fallback = {
      ...(conf.resolve.fallback || {}),
      path: false,
      os: false,
      fs: false,
      'fs-extra': false
    };
  });

  // optionaly you can run:
  // require('@ucd-lib/cork-app-build').watch(config, true)
  // Adding the second flag will generate a ie build as well as a modern
  // build when in development.  Note this slows down the build process.

  module.exports = config;
