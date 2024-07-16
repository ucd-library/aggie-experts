import fs from 'fs';
import path from 'path';

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class Schema {

  static Frame = {};
  static Context = {};

  static async frame(id,version) {
    const {major, minor} = version;
    return frames[version];
  }

  static async context(id,version=process.env.TAG) {
    let Context = Schema.Context;

    if (! Context[id]) {
      Context[id] = {};
    }
    if (! Context[id][version]) {
      // get major and minor version, by splitting on '.'
      const [major, minor] = version.split('.');
      let file = path.join(__dirname,`${id}/${major}.${minor}/context.jsonld`);
      // if the file does not exist, try the major version
      if (! fs.existsSync(file)) {
        file = path.join(__dirname,`${id}/${major}/context.jsonld`);
        if (! fs.existsSync(file)) {
          throw new Error(`${id}/${version}/context.jsonld not found`);
        }
      }
      const fileContents = fs.readFileSync(file, 'utf8');
      Context[id][version] = JSON.parse(fileContents);
    }
    return Context[id][version];
  }
}
