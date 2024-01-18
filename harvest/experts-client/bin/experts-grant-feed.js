#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import FusekiClient from '../lib/fuseki-client.js';
import Client from 'ssh2-sftp-client';
import { Storage } from '@google-cloud/storage';
// import fs from 'fs/promises';
import { GoogleSecret } from '@ucd-lib/experts-api';

const gs = new GoogleSecret();

const program = new Command();

program
  .version('1.0.0')
  .description('Upload a file to a remote SFTP server')
  .requiredOption('-b, --bucket <bucket>', 'GCS bucket name')
  .requiredOption('-s, --source <source>', 'Source file path in GCS')
  .requiredOption('-o, --output <output>', 'Local output file path')
  .requiredOption('-h, --host <host>', 'SFTP server hostname')
  .requiredOption('-u, --username <username>', 'SFTP username')
  .requiredOption('-r, --remote <remote>', 'Remote file path on the Symplectic server')
  .parse(process.argv);

let opt = program.opts();

const sftpConfig = {
  host: opt.host,
  port: opt.port || 22,
  username: opt.username,
};

const storage = new Storage({
  projectId: 'aggie-experts',
  // keyFilename: 'path/to/your/keyfile.json',
});

const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb2',
  db: 'CAS',
  replace: true,
  'delete': false
});

var localFilePath = ''; // A default local file path
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

async function downloadFile(bucketName, fileName, destinationPath) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  try {
    // Create a read stream from the file and pipe it to a local file
    const readStream = file.createReadStream();
    const writeStream = fs.createWriteStream(destinationPath);

    readStream.on('error', err => {
      console.error('Error reading stream:', err);
    });

    writeStream.on('finish', () => {
      console.log(`File downloaded successfully to: ${destinationPath}`);
    });

    await readStream.pipe(writeStream);
  } catch (error) {
    console.error('Error downloading file:', error.message);
  }
}

async function main(opt) {

  // Retrieve the grants source file from GCS
  localFilePath = opt.output + opt.source; // The file to be transferred to the Symplectic server
  // First download the file from GCS
  await downloadFile(opt.bucket, opt.source, localFilePath);

  // Retrieve the SFTP password from GCS Secret Manager
  sftpConfig.password = await gs.getSecret(opt.secretpath);

  // Perform the SFTP upload
  uploadFile();

}

await main(opt);
