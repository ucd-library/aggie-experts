
import GoogleSecret from './lib/googleSecret.js';
import ElementsClient from './lib/elements-client.js';
import Schema from './lib/schema/index.js';
import ExpertsKcAdminClient from './lib/keycloak-admin.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultFrame = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'frames', 'default.json'), 'utf8'));
// import defaultFrame from './lib/frames/default.json' with { type: 'json' };

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
