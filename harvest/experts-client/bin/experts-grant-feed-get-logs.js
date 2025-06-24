#!/usr/bin/env node

/* Transform the Aggie Enterprise grant feed into VIVO RDF and upload to the Symplectic server
   rakunkel@ucdavis.edu */

import { Command } from '../lib/experts-commander.js';
import { GoogleSecret } from '@ucd-lib/experts-api';
import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
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
  .option('-ssp, --slacksecretpath <slacksecretpath>', 'Secret Manager Slack secret path', 'projects/325574696734/secrets/ae-grant-slack-webhook-url')
  .option('-do, --offset <offset>', 'Offset(days) to the most recent directory', 0)
  .option('-ln, --logName <logName>', 'Log name to retreive', 'UCDavis_Grants_Feed_logs')
  .option_log()
  .parse(process.argv);

// Creates a client
const storage = new Storage();

// Log names: UCDavis_Grants_Feed_logs UCDavis_Delete_Grants_Records_Logs UCDavis_Delete_User_Links_Logs

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

async function postToSlack(message) {
  try {
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: message })
    });

    if (!response.ok) {
      throw new Error(`Error posting message to Slack: ${response.statusText}`);
    }

    log.info(`Message posted to Slack: ${message}`);
  } catch (error) {
    log.error('Error posting message to Slack:', error.message);
  }
}

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

    // Download files from the most recent directory that are txt files

    const files = await sftp.list(mostRecentDirectoryPath);
    const textFiles = files.filter(file => file.name.endsWith('.txt'));

    for (const file of textFiles) {
      const remoteFilePath = `${mostRecentDirectoryPath}/${file.name}`;
      const localFilePath = `${localFolderPath}/${file.name}`;
      await sftp.get(remoteFilePath, fs.createWriteStream(localFilePath));
      log.info(`File downloaded successfully: ${remoteFilePath} -> ${localFilePath}`);
      // If the filename contains 'error', 'summary', or 'notes' send it via email
      if (file.name.toLowerCase().includes('error') || file.name.toLowerCase().includes('summary') || file.name.toLowerCase().includes('notes')) {
        log.info('Copying to bucket -' + file.name);
        // copy the file to the GCS bucket
        uploadFileGCS(localFilePath, file.name);
        if (file.name.toLowerCase().includes('error') || file.name.toLowerCase().includes('summary')) {
          // Read the file and send it via email
          const fileContent = fs.readFileSync(localFilePath, 'utf8');
          // Post to the Slack webhook URL
          log.info('Posting to Slack');
          postToSlack(fileContent);
        }
      }
    }
  } catch (error) {
    log.error('Error downloading files from the most recent directory:', error.message);
  }
}

async function uploadFileGCS(localFilePath, destinationFileName) {
  try {
    const bucketName = 'aggie-enterprise'; // Replace with your GCS bucket name
    const bucket = storage.bucket(bucketName);
    const destination = path.join('grants/Logs', opt.env, opt.logName, destinationFileName); // Adjust the path in the bucket as needed

    await bucket.upload(localFilePath, {
      destination: destination,
    });

    log.info(`File uploaded to GCS: ${localFilePath} -> gs://${bucketName}/${destination}`);
  } catch (error) {
    log.error('Error uploading file to GCS:', error.message);
  }
}

// Function to upload empty csv files to Sympletic server
async function uploadEmptyCSVToSymplectic() {
  try {
    // SFTP the each empty CSV file to the Symplectic server
    const emptyCSVPath = path.join('../lib/grants/csv-templates');
    const files = fs.readdirSync(emptyCSVPath);
    for (const file of files) {
      const localFilePath = path.join(emptyCSVPath, file);
      const remoteFilePath = `/PROD/${file}`;
      log.info(`Uploading empty CSV file to Symplectic: ${localFilePath} -> ${remoteFilePath}`);
      await sftp.put(localFilePath, remoteFilePath);
      log.info(`Empty CSV file uploaded successfully: ${remoteFilePath}`);
    }
  } catch (error) {
    log.error('Error uploading empty CSV files to Symplectic:', error.message);
  }

// Ensure the output directory exists
if (!fs.existsSync(opt.output + '/' + opt.prefix + opt.logName)) {
  fs.mkdirSync(opt.output + '/' + opt.prefix + opt.logName, { recursive: true });
}

}

const remoteFolderPath = '/PROD/Logs/' + opt.logName; // UCDavis_Grants_Feed_logs;
const localFolderPath = opt.output + '/' + opt.prefix + opt.logName;

ftpConfig.password = await gs.getSecret(opt.secretpath);
const slackWebhookUrl = await gs.getSecret(opt.slacksecretpath);

downloadFilesFromMostRecentDirectory(remoteFolderPath, localFolderPath, opt.offset);
uploadEmptyCSVToSymplectic();
await sftp.end();
