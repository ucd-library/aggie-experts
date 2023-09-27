let {config} = require('@ucd-lib/fin-service-utils');

let env = process.env.CLIENT_ENV || 'dev';

let clientPackage = require('./client/public/package.json');

let clientPackageVersion = clientPackage.version;
if( process.env.APP_VERSION ) {
  clientPackageVersion = process.env.APP_VERSION;
}

config.client = {
  title : 'Aggie Experts',
  description : 'Aggie Experts is a research networking and expertise discovery tool for UC Davis.',
  appName : process.env.FIN_APP_NAME || 'spa',
  assets : (env === 'prod') ? 'dist' : 'public',
  appRoutes : ['home', 'work', 'person', 'grant'],
  versions : {
    bundle : clientPackageVersion,
    loader : clientPackage.dependencies['@ucd-lib/cork-app-load'].replace(/^\D/, '')
  },

  env : {
    CLIENT_ENV : env,
    FIN_APP_VERSION : process.env.FIN_APP_VERSION || '',
    FIN_REPO_TAG : process.env.FIN_REPO_TAG || '',
    FIN_BRANCH_NAME : process.env.FIN_BRANCH_NAME || '',
    FIN_SERVER_REPO_HASH : process.env.FIN_SERVER_REPO_HASH || '',
    APP_VERSION : process.env.APP_VERSION || '',
    BUILD_NUM : process.env.BUILD_NUM || '',
    // UCD_DAMS_REPO_BRANCH : process.env.UCD_DAMS_REPO_BRANCH || '',
    // UCD_DAMS_REPO_TAG : process.env.UCD_DAMS_REPO_TAG || '',
    // UCD_DAMS_REPO_SHA : process.env.UCD_DAMS_REPO_SHA || '',
    // UCD_DAMS_DEPLOYMENT_SHA : process.env.UCD_DAMS_DEPLOYMENT_SHA || '',
    // UCD_DAMS_DEPLOYMENT_BRANCH : process.env.UCD_DAMS_DEPLOYMENT_BRANCH || '',
    // UCD_DAMS_DEPLOYMENT_TAG : process.env.UCD_DAMS_DEPLOYMENT_TAG || '',
    FIN_SERVER_IMAGE : process.env.FIN_SERVER_IMAGE || ''
  }
};

module.exports = config;
