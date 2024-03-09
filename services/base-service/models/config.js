const {config}= require('@ucd-lib/fin-service-utils');

const models_package = require('./package.json');

// This is short lived, so we are only using the config file for this.
config.experts = {
  version: models_package.version,
  cdl: {
    expert: {
      propagate: (process.env.CDL_PROPAGATE_CHANGES === "true") || false,
      instance:"qa" },
    grant_role: {
      propagate: (process.env.CDL_PROPAGATE_CHANGES === "true") || false,
      instance:"qa"},
    authorship: {
      propagate: (process.env.CDL_PROPAGATE_CHANGES === "true") || false,
      instance:"prod"
    }
  }
};

module.exports = config;
