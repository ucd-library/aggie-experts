#!/usr/bin/env node

/* Transform the Aggie Enterprise grant feed into VIVO RDF and upload to the Symplectic server
   rakunkel@ucdavis.edu */

import { Command } from '../lib/experts-commander.js';
import Client from 'ssh2-sftp-client';
import { spawnSync } from 'child_process';
import fs from 'fs';

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();
program
  .version('1.0.0')
  .description('Process the Aggie Enterprise grant feed')
  .option('--env <env>', '', 'PROD')
  .requiredOption('-xml, --xml <xml>', 'Source file path in GCS')
  .requiredOption('-o, --output <output>', 'Local output file path')
  .option('--upload', 'Upload the file to the SFTP server')
  .option('-h, --host <host>', 'SFTP server hostname', 'ftp.use.symplectic.org')
  .option('-u, --username <username>', 'SFTP username', 'ucdavis')
  .option('--fuseki <db>', 'Fuseki database name', 'ae-grants')
  .option('-r, --remote <remote>', 'Remote file path on the Symplectic server')
  .option('-n, --new <new>', 'GCS (XML) file generation', 0)
  .option('-p, --prev <prev>', 'GCS (XML) file generation', 1)
  .option('-sp, --secretpath <secretpath>', 'Secret Manager secret path', 'projects/325574696734/secrets/Symplectic-Elements-FTP-ucdavis-password')
  .option_fuseki()
  .option_log()
  .parse(process.argv);

let opt = await program.opts();

if (opt.env === 'PROD') {
  opt.prefix = 'Prod_UCD_';
} else if (opt.env === 'QA') {
  opt.prefix = '';
} else {
  opt.prefix = '';
}

const log = opt.log;

const ftpConfig = {
  host: opt.host,
  port: opt.port || 22,
  username: opt.username,
};

const sftp = new Client();

async function uploadFile(localFilePath, remoteFileName) {
  try {
    await sftp.connect(ftpConfig);
    log.info(localFilePath, remoteFileName);
    await sftp.put(fs.createReadStream(localFilePath), remoteFileName);
    log.info(`File uploaded successfully: ${localFilePath} -> ${remoteFileName}`);
  } catch (error) {
    log.error('Error uploading file:', error.message);
  } finally {
    await sftp.end();
  }
}

// Ensure the output directory exists
if (!fs.existsSync(opt.output)) {
  fs.mkdirSync(opt.output, { recursive: true });
}
// Get the current log level to use as a parameter for the child processes
// Declare a variable to hold the log level
let logLevel = 'fatal';

switch (log.level()) {
  case 20:
    logLevel = 'debug';
    break;
  case 30:
    logLevel = 'info';
    break;
  case 40:
    logLevel = 'warn';
    break;
  case 50:
    logLevel = 'error';
    break;
  case 60:
    logLevel = 'fatal';
    break;
  default:
    logLevel = 'fatal';
}

// Command-line parameters to pass to experts-grant-feed.js
const params = ['--env=' + opt.env, '--xml=' + opt.xml, '--generation=' + opt.new, '--output=' + opt.output];
params.push('--log=' + logLevel);
log.info('Parameters1:', params);
log.info(__dirname + '/experts-grant-feed.js', params);
const result1 = spawnSync('node', [__dirname + '/experts-grant-feed.js', ...params], { encoding: 'utf8' });

log.info('Output 1:', result1.stdout);
if (result1.error) {
  log.error('Execution error 1:', result1.error);
}
log.info('Exit code 1:', result1.status);

const params2 = ['--env=' + opt.env, '--xml=' + opt.xml, '--generation=' + opt.prev, '--output=' + opt.output];
params2.push('--log=' + logLevel);

log.info('Parameters2:', params2);
log.info(__dirname + '/experts-grant-feed.js', params2);
const result2 = spawnSync('node', [__dirname + '/experts-grant-feed.js', ...params2], { encoding: 'utf8' });
log.info('Output 2:', result2.stdout);
if (result2.error) {
  log.error('Execution error 2:', result2.error);
}
log.info('Exit code 2:', result2.status);

log.info('Options:', opt);
const params3 = ['--env=' + opt.env, '--output=' + opt.output, '--new=' + opt.new, '--prev=' + opt.prev];
params3.push('--log=' + logLevel);
log.info('Parameters2:', params3);
log.info(__dirname + '/experts-grant-feed-delta.js', params3);
const result3 = spawnSync('node', [__dirname + '/experts-grant-feed-delta.js', ...params3], { encoding: 'utf8' });
log.info('Output 3:', result3.stdout);
if (result3.error) {
  log.error('Execution error 3:', result3.error);
}
log.info('Exit code 3:', result3.status);

// Perform the SFTP upload
if (opt.upload) {
  // Retrieve the SFTP password from GCS Secret Manager
  ftpConfig.password = await opt.gs.getSecret(opt.secretpath);
  const grantFile = opt.output + '/delta/' + opt.prefix + 'grants_metadata.csv';
  const linkFile = opt.output + '/delta/' + opt.prefix + 'grants_links.csv';
  const personFile = opt.output + '/delta/' + opt.prefix + 'grants_persons.csv';
  const deleteLinks = opt.output + '/delta/' + opt.prefix + 'delete_user_grants_links.csv';
  await uploadFile(grantFile, opt.env + '/' + opt.prefix + "grants_metadata.csv");
  await uploadFile(linkFile, opt.env + '/' + opt.prefix + "grants_links.csv");
  await uploadFile(personFile, opt.env + '/' + opt.prefix + "grants_persons.csv");
  await uploadFile(deleteLinks, opt.env + '/' + opt.prefix + "delete_user_grants_links.csv");
}


