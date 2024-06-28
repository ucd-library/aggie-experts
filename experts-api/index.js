import defaultFrame from './lib/frames/default.json' assert { type: 'json' };
import GoogleSecret from './lib/googleSecret.js';
import ElementsClient from './lib/elements-client.js';
import models_package from './package.json' with  { type: 'json' }

import ExpertsKcAdminClient from './lib/keycloak-admin.js';
export const frames = {
  default: defaultFrame
};


// This is short lived, so we are only using the config file for this.
const config = {
  version: models_package.version,
  ver: {
    major: models_package.version.split('.')[0],
    minor: models_package.version.split('.')?.[1],
    patch: models_package.version.split(/[.-]/)?.[2],
    ext: models_package.version.replace(/^[^-]*-/, '')
  }
};

export { GoogleSecret, ElementsClient, ExpertsKcAdminClient, config };
