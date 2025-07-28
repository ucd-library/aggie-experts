import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import transform from '../lib/transform/index.js';
import config from '../lib/config.js';
import PgClient from '../lib/pg-client.js';
import { enableFromCli } from '../lib/reporting/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();


const env = process.env;
const ODR_ARK = 'ark:/87287/d7c08j';
const CDL_ARK = 'ark:/87287/d7mh2m';
const UCOP_VOCAB_FILE = 'vocabularies/experts.ucdavis.edu%2Fucop/pos_codes.jsonld';

program.name('transform')
  .description('transform data from cdl & iam into aggie experts format')
  .argument('<user-id>', 'User id to extract')
  .option('--force', 'Force extraction even if data already exists on disk')
  .option('--root-dir <root-dir>', 'Root directory for transformed data.  Respects env EXPERTS_ROOT_DIR')
  .option('--reporting', 'Enable reporting for this transformation')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .action(async (userId, options) => {

    if (options.reportingJobId || options.reporting) {
      await enableFromCli('experts-harvest-transform', userId, options);
    }

    await transform({
      user: userId,
      force: options.force,
      rootDir: options.rootDir
    });

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }

    // console.log('Transforming data for user:', userId);
    // console.log('Root directory for transformed data:', options.rootDir);

    // let userDir = path.join(options.rootDir, userId);
    // if (!fs.existsSync(userDir)) {
    //   console.error(`User directory does not exist: ${userDir}`);
    //   return;
    // }

    // let odrFile = path.join(userDir, ODR_ARK, 'profile.jsonld');
    // if (!fs.existsSync(odrFile)) {
    //   console.error(`ODR file does not exist: ${odrFile}`);
    //   return;
    // }

    // let cdlDir = path.join(userDir, CDL_ARK);
    // if (!fs.existsSync(cdlDir)) {
    //   console.error(`CDL directory does not exist: ${cdlDir}`);
    //   return;
    // }

    // let cdlFiles = fs.readdirSync(cdlDir)
    //   .filter(file => file.match(/^user_\d\d\d\.jsonld$/))
    //   .map(file => path.join(cdlDir, file));

    // if (cdlFiles.length === 0) {
    //   console.error(`No CDL JSON-LD files found in directory: ${cdlDir}`);
    //   return;
    // }

    // // uc position vocabulary file
    // let ucopVocabFile = path.resolve(__dirname, '..', '..', UCOP_VOCAB_FILE);
    // if (!fs.existsSync(ucopVocabFile)) {
    //   console.error(`UCOP vocabulary file does not exist: ${ucopVocabFile}`);
    //   return;
    // }

    // let result = await runFromFiles(odrFile, cdlFiles, ucopVocabFile);

    // // read in old version
    // let id = result[0]['@id'].split('/').pop();
    // let oldFile = path.join(userDir, 'fcrepo', 'expert', id + '.jsonld.json');

    // if (fs.existsSync(oldFile)) {
    //   let oldData = fs.readJSONSync(oldFile);
    //   let verified = verify(oldData, result);
    //   console.log('Changes detected:', JSON.stringify(verified, null, 2));

    //   // save the transformed data
    //   let newFile = path.join(userDir, 'fcrepo', 'expert', id + '.new' + '.jsonld.json');
    //   fs.writeJSONSync(newFile, sortJsonArrayByIdAndKeys(result), { spaces: 2 });
    //   console.log(`Transformed data saved to: ${newFile}`);
    // }

    // console.log(result);
  });

program.parse(process.argv);
