#!/usr/bin/env node

/* Transform the Aggie Enterprise grant feed into VIVO RDF and upload to the Symplectic server
   rakunkel@ucdavis.edu */

import { Command } from '../lib/experts-commander.js';
import { GoogleSecret } from '@ucd-lib/experts-api';
import fs from 'fs';
import Client from 'ssh2-sftp-client';

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const gs = new GoogleSecret();


const program = new Command();
program
  .version('1.0.0')
  .description('Process the Aggie Enterprise grant feed')
  .option('--env <env>', '', 'PROD')
  .requiredOption('-o, --output <output>', 'Local output file path')
  .option('-h, --host <host>', 'SFTP server hostname', 'ftp.use.symplectic.org')
  .option('-u, --username <username>', 'SFTP username', 'ucdavis')
  .option('-sp, --secretpath <secretpath>', 'Secret Manager secret path', 'projects/325574696734/secrets/Symplectic-Elements-FTP-ucdavis-password')
  .option('-do, --offset <offset>', 'Offset(days) to the most recent directory', 0)
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

async function downloadFilesFromMostRecentDirectory(remoteFolderPath, localFolderPath, offset = 0) {
  try {
    await sftp.connect(ftpConfig);
    log.info(`Connected to SFTP server to list directories in: ${remoteFolderPath}`);

    const fileList = await sftp.list(remoteFolderPath);
    const directories = fileList.filter(file => file.type === 'd');

    if (directories.length === 0) {
      log.info('No directories found');
      return;
    }

    directories.sort((a, b) => new Date(b.modifyTime) - new Date(a.modifyTime));
    const mostRecentDirectory = directories[offset];
    const mostRecentDirectoryPath = `${remoteFolderPath}/${mostRecentDirectory.name}`;

    log.info(`Most recently created directory: ${mostRecentDirectoryPath}`);

    const files = await sftp.list(mostRecentDirectoryPath);
    for (const file of files) {
      const remoteFilePath = `${mostRecentDirectoryPath}/${file.name}`;
      const localFilePath = `${localFolderPath}/${file.name}`;
      await sftp.get(remoteFilePath, fs.createWriteStream(localFilePath));
      log.info(`File downloaded successfully: ${remoteFilePath} -> ${localFilePath}`);
    }
  } catch (error) {
    log.error('Error downloading files from the most recent directory:', error.message);
  } finally {
    await sftp.end();
  }
}

// Ensure the output directory exists
if (!fs.existsSync(opt.output)) {
  fs.mkdirSync(opt.output, { recursive: true });
}

// Example usage
const remoteFolderPath = '/PROD/Logs/UCDavis_Grants_Feed_logs';
const localFolderPath = opt.output;

ftpConfig.password = await gs.getSecret(opt.secretpath);

downloadFilesFromMostRecentDirectory(remoteFolderPath, localFolderPath, opt.offset);
