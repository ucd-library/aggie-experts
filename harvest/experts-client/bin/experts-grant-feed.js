#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import Client from 'ssh2-sftp-client';

import { GoogleSecret } from '@ucd-lib/experts-api';

const gs = new GoogleSecret();

const program = new Command();

program
  .version('1.0.0')
  .description('Upload a file to a remote SFTP server')
  .requiredOption('-h, --host <host>', 'SFTP server hostname')
  .requiredOption('-u, --username <username>', 'SFTP username')
  .requiredOption('-l, --local <local>', 'test.csv')
  .requiredOption('-r, --remote <remote>', 'Remote file path on the server')
  .parse(process.argv);

let opt = program.opts();

const sftpConfig = {
  host: opt.host,
  port: opt.port || 22,
  username: opt.username,
};

const localFilePath = path.resolve(opt.local);
const remoteFilePath = opt.remote;

opt.secretpath = 'projects/325574696734/secrets/Symplectic-Elements-FTP-ucdavis-password';

const sftp = new Client();

async function uploadFile() {

  try {
    await sftp.connect(sftpConfig);
    await sftp.put(fs.createReadStream(localFilePath), remoteFilePath);

    console.log(`File uploaded successfully: ${localFilePath} -> ${remoteFilePath}`);
  } catch (error) {
    console.error('Error uploading file:', error.message);
  } finally {
    await sftp.end();
  }
}

async function main(opt) {

  sftpConfig.password = await gs.getSecret(opt.secretpath);
  uploadFile();

}

await main(opt);
