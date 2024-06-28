import {config } from './config.js' with {type:'json'}; // import config.json
export default class Schema {

  const frames = {};
  const context = {};

  static async frame(id,version) {
    const {major, minor} = version;
    return frames[version];
  }

  static async context(id,version='default') {
    if (version.match(/dirty/)) {
      version = 'default';
    }
    if (! context[id][version]) {
      if (! context[id]) {
        context[id] = {};
      }
      context[id][version] = fs.readFileSync(`./lib/contexts/${id}/${version}.json`, 'utf8');
    }
    return context[id][version];
  }
}
