const {config}= require('@ucd-lib/fin-service-utils');

const models_package = require('./package.json');

config.experts = {
  version: models_package.version,
  cdl_propagate_changes : (process.env.CDL_PROPAGATE_CHANGES === "true") || false
};

module.exports = config;
