const {config}= require('@ucd-lib/fin-service-utils');

const models_package = require('./package.json');

config.experts = {
  version: models_package.version,
  cdl_propogate_changes : (process.env.CDL_PROPOGATE_CHANGES === "true") || false
};

module.exports = config;
