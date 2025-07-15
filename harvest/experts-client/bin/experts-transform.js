import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

import { runFromFiles } from '../lib/transform/person.js';
import verify from '../lib/transform/verify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();


const env = process.env;
const ODR_ARK = 'ark:/87287/d7c08j';
const CDL_ARK = 'ark:/87287/d7mh2m';
const UCOP_VOCAB_FILE = 'vocabularies/experts.ucdavis.edu%2Fucop/pos_codes.jsonld';

program.name('transform')
  .description('transform data from cdl & iam into aggie experts format')
  .option('--user <user-id>', 'User id to transform')
  .option('--root-dir <root-dir>', 'Root directory for transformed data.  Respects env EXPERTS_ROOT_DIR', env.EXPERTS_ROOT_DIR || process.cwd())
  .action(async (options) => {
    function sortJsonArrayByIdAndKeys(jsonArray) {
      // sort the array by '@id', then by keys for each
      jsonArray.sort((a, b) => {
        if (a['@id'] < b['@id']) return -1;
        if (a['@id'] > b['@id']) return 1;
        return 0;
      });

      return jsonArray.map(obj => {
        const sortedKeys = Object.keys(obj).filter(k => k !== '@id').sort();
        const newObj = { '@id': obj['@id'] };
        for (const key of sortedKeys) {
          newObj[key] = obj[key];
        }
        return newObj;
      });
    }

    console.log('Transforming data for user:', options.user);
    console.log('Root directory for transformed data:', options.rootDir);

    let userDir = path.join(options.rootDir, options.user);
    if (!fs.existsSync(userDir)) {
      console.error(`User directory does not exist: ${userDir}`);
      return;
    }

    let odrFile = path.join(userDir, ODR_ARK, 'profile.jsonld');
    if (!fs.existsSync(odrFile)) {
      console.error(`ODR file does not exist: ${odrFile}`);
      return;
    }

    let cdlDir = path.join(userDir, CDL_ARK);
    if (!fs.existsSync(cdlDir)) {
      console.error(`CDL directory does not exist: ${cdlDir}`);
      return;
    }

    let cdlFiles = fs.readdirSync(cdlDir)
      .filter(file => file.match(/^user_\d\d\d\.jsonld$/))
      .map(file => path.join(cdlDir, file));

    if (cdlFiles.length === 0) {
      console.error(`No CDL JSON-LD files found in directory: ${cdlDir}`);
      return;
    }

    // uc position vocabulary file
    let ucopVocabFile = path.resolve(__dirname, '..', '..', UCOP_VOCAB_FILE);
    if (!fs.existsSync(ucopVocabFile)) {
      console.error(`UCOP vocabulary file does not exist: ${ucopVocabFile}`);
      return;
    }

    let result = await runFromFiles(odrFile, cdlFiles, ucopVocabFile);

    // read in old version
    let id = result[0]['@id'].split('/').pop();
    let oldFile = path.join(userDir, 'fcrepo', 'expert', id + '.jsonld.json');

    if (fs.existsSync(oldFile)) {
      let oldData = fs.readJSONSync(oldFile);
      let verified = verify(oldData, result);
      console.log('Changes detected:', JSON.stringify(verified, null, 2));

      // save the transformed data
      let newFile = path.join(userDir, 'fcrepo', 'expert', id + '.new' + '.jsonld.json');
      fs.writeJSONSync(newFile, sortJsonArrayByIdAndKeys(result), { spaces: 2 });
      console.log(`Transformed data saved to: ${newFile}`);
    }

    console.log(result);
  });

program.parse(process.argv);
