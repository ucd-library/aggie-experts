const {config} = require('@ucd-lib/fin-service-utils');

let experts_package = require('../package.json');
let experts_package_version = api_package.version;

config.api = {
  cdl_propogate_changes : (process.env.API_CDL_PROPOGATE_CHANGES === "true") || false
}
