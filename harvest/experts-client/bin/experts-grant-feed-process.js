#!/usr/bin/env node

/* Transform the Aggie Enterprise grant feed into VIVO RDF and upload to the Symplectic server
   rakunkel@ucdavis.edu */

import { Command } from 'commander';
import { spawnSync } from 'child_process';
import { logger } from '../lib/logger.js';

const program = new Command();

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

program
  .version('1.0.0')
  .description('Process the Aggie Enterprise grant feed')
  .option('--env <env>', '', 'QA')
  .requiredOption('-xml, --xml <xml>', 'Source file path in GCS')
  .requiredOption('-o, --output <output>', 'Local output file path')
  .option('--upload', 'Upload the file to the SFTP server')
  .option('-h, --host <host>', 'SFTP server hostname')
  .option('-u, --username <username>', 'SFTP username')
  .option('--fuseki <db>', 'Fuseki database name', 'ae-grants')
  .option('-r, --remote <remote>', 'Remote file path on the Symplectic server')
  .option('-n, --new <new>', 'GCS (XML) file generation', 0)
  .option('-p, --prev <prev>', 'GCS (XML) file generation', 1)
  .option('-d, --delta <delta>', 'GCS (XML) file generation', 'delta')
  .option('-sp, --secretpath <secretpath>', 'Secret Manager secret path', 'projects/325574696734/secrets/Symplectic-Elements-FTP-ucdavis-password')
  .parse(process.argv);

let opt = program.opts();
console.log('Options:', opt);

const ftpConfig = {
  host: opt.host,
  port: opt.port || 22,
  username: opt.username,
};


// Command-line parameters to pass to experts-grant-feed.js
// const params = ['--env=' + opt.env, '--fuseki=' + opt.fuseki, '--xml=' + opt.xml, '--generation=' + opt.new, '--output=' + opt.output];
// console.log('Parameters1:', params);
// console.log(__dirname + '/experts-grant-feed.js', params);
// const result1 = spawnSync('node', [__dirname + '/experts-grant-feed.js', ...params], { encoding: 'utf8' });

// console.log('Output 1:', result1.stdout);
// if (result1.error) {
//   console.error('Execution error 1:', result1.error);
// }
// console.log('Exit code 1:', result1.status);

// const params2 = ['--env=' + opt.env, '--fuseki=' + opt.fuseki, '--xml=' + opt.xml, '--generation=' + opt.previous, '--output=' + opt.output];
// console.log('Parameters2:', params2);
// console.log(__dirname + '/experts-grant-feed.js', params2);
// const result2 = spawnSync('node', [__dirname + '/experts-grant-feed.js', ...params2], { encoding: 'utf8' });
// console.log('Output 2:', result2.stdout);
// if (result2.error) {
//   console.error('Execution error 2:', result2.error);
// }
// console.log('Exit code 2:', result2.status);

console.log('Options:', opt);
const params3 = ['--env=' + opt.env, '--dir=' + opt.output, '--new=' + opt.new, '--prev=' + opt.prev, '--delta=' + opt.delta, '--debug=true'];
console.log('Parameters2:', params3);
console.log(__dirname + '/experts-grant-feed.js', params3);
const result3 = spawnSync('node', [__dirname + '/experts-grant-feed-delta.js', ...params3], { encoding: 'utf8' });
console.log('Output 3:', result3.stdout);
if (result3.error) {
  console.error('Execution error 3:', result3.error);
}
console.log('Exit code 3:', result3.status);



