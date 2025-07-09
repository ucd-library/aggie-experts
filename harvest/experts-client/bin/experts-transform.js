import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

import { runFromFiles } from '../lib/transform/person.js';
import verify from '../lib/transform/verify.js';

const program = new Command();


const env = process.env;
const ODR_ARK = 'ark:/87287/d7c08j';
const CDL_ARK = 'ark:/87287/d7mh2m';

program.name('transform')
  .description('transform data from cdl & iam into aggie experts format')
  .option('--user <user-id>', 'User id to transform')
  .option('--root-dir <root-dir>', 'Root directory for transformed data.  Respects env EXPERTS_ROOT_DIR', env.EXPERTS_ROOT_DIR || process.cwd())
  .action(async (options) => {
    console.log('Transforming data for user:', options.user);
    console.log('Root directory for transformed data:', options.rootDir);

    let userDir = path.join(options.rootDir, 'mailto:' + options.user);
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

    let result = await runFromFiles(odrFile, cdlFiles);
    
    // read in old version
    let id = result[0]['@id'].split('/').pop();
    let oldFile = path.join(userDir, 'fcrepo', 'expert', id + '.jsonld.json');

    if (fs.existsSync(oldFile)) {
      let oldData = fs.readJSONSync(oldFile);
      let verified = verify(oldData, result);
      console.log('Changes detected:', JSON.stringify(verified, null, 2));
    }
  });

program.parse(process.argv);
