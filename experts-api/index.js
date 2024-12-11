import defaultFrame from './lib/frames/default.json' assert { type: 'json' };
import GoogleSecret from './lib/googleSecret.js';
import ElementsClient from './lib/elements-client.js';
import Schema from './lib/schema/index.js';

//import models_package from './package.json' with  { type: 'json' }

import ExpertsKcAdminClient from './lib/keycloak-admin.js';

const context=await Schema.context('expert')
// replace the context in the default frame
defaultFrame["@context"]=context["@context"]

export const frames = {
  default: defaultFrame
};

export {
  GoogleSecret,
  ElementsClient,
  ExpertsKcAdminClient,
//  config,
  Schema
}
