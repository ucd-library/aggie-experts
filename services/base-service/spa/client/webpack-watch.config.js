let config = require('@ucd-lib/cork-app-build').watch({
    // root directory, all paths below will be relative to root
    root : __dirname,
    // path to your entry .js file
    entry : 'public/index.js',
    // folder where bundle.js will be written
    preview : 'public/js',
    // path your client (most likely installed via yarn) node_modules folder.
    // Due to the flat:true flag of yarn, it's normally best to separate
    // client code/libraries from all other modules (ex: build tools such as this).
    // will take an array of relative paths as well
    clientModules : 'public/node_modules'
  });

  if( !Array.isArray(config) ) config = [config];
  config.forEach(conf => {
    conf.output.publicPath = '/js/';
  });

  // optionaly you can run:
  // require('@ucd-lib/cork-app-build').watch(config, true)
  // Adding the second flag will generate a ie build as well as a modern
  // build when in development.  Note this slows down the build process.

  module.exports = config;
