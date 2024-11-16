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
    return frames[version];
  }

  static async context(id,version) {
    let Context = Schema.Context;

    if (! version) {
      if (! Context[id]) {
        // get the file with the highest version number
        const versions = fs.readdirSync(path.join(__dirname,id));
        const version = versions.reduce((a,b) => {
          const [majorA, minorA] = a.split('.');
          const [majorB, minorB] = b.split('.');
          if (majorA > majorB) {
            return a;
          } else if (majorA < majorB) {
            return b;
          } else {
            if (minorA > minorB) {
              return a;
            } else {
              return b;
            }
          }
        });
        console.log('versions',versions);
        console.log('version',version);
        let file = path.join(__dirname,`${id}/${version}/context.jsonld`);
        const fileContents = fs.readFileSync(file, 'utf8');
        Context[id] = JSON.parse(fileContents);
      }
      return Context[id];
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
