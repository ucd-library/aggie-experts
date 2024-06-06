let config = require('@ucd-lib/cork-app-build').dist({
    // root directory, all paths below will be relative to root
    root : __dirname,
    entry : 'public/index.js',
    // folder where bundle.js and ie-bundle.js will be written
    dist : 'public/js',
    preview : 'public/js',
    clientModules : 'public/node_modules'
  });

  // optionaly you can run:
  // require('@ucd-lib/cork-app-build').watch(config, true)
  // Adding the second flag will generate a ie build as well as a modern
  // build when in development.  Note this slows down the build process.

  module.exports = config;
