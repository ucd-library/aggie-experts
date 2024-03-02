const models_package = require('../package.json');

// This is short lived, so we are only using the config file for this.
config {
  version: models_package.version,
  ver: {
    major: models_package.version.split('.')[0],
    minor: models_package.version.split('.')[1],
    patch: models_package.version.split('.')?.[2],
    ext: models_package.version.split('-')?.[1]
  };

module.exports = config;
