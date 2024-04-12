#!/usr/bin/env node

/* Transform the Aggie Enterprise grant feed into VIVO RDF and upload to the Symplectic server
   rakunkel@ucdavis.edu */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { spawnSync } from 'child_process';
import FusekiClient from '../lib/fuseki-client.js';
import Client from 'ssh2-sftp-client';
import { Storage } from '@google-cloud/storage';
import { GoogleSecret } from '@ucd-lib/experts-api';
import parser from 'xml2json';

const gs = new GoogleSecret();

const program = new Command();

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


program
  .version('1.0.0')
  .description('Upload a file to a remote SFTP server')
  .requiredOption('-xml, --xml <xml>', 'Source file path in GCS')
  .requiredOption('-o, --output <output>', 'Local output file path')
  .requiredOption('-h, --host <host>', 'SFTP server hostname')
  .requiredOption('-u, --username <username>', 'SFTP username')
  .requiredOption('--fuseki <db>', 'Fuseki database name')
  .requiredOption('-r, --remote <remote>', 'Remote file path on the Symplectic server')
  .parse(process.argv);

let opt = program.opts();

const sftpConfig = {
  host: opt.host,
  port: opt.port || 22,
  username: opt.username,
};

const storage = new Storage();

// GCS storage
// XML file to be downloaded from GCS and converted to JSON
// If xml starts with gs://, download the file from GCS
if (opt.xml.startsWith('gs://')) {
  const [, , bucketName, ...filePathParts] = opt.xml.split('/');
  const filePath = filePathParts.join('/');
  opt.bucket = bucketName;
  opt.filePath = filePath;
  console.log(`Bucket: ${bucketName}`);
  console.log(`File: ${filePath}`);
}

// fusekize opt
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^fuseki./, '')
  if (n !== k) {
    fuseki[n] = opt[k];
    delete opt[k];
  }
});

const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb2',
  db: opt.db,
  replace: true,
  'delete': false
});

// SFTP configuration
const remoteFilePath = opt.remote;

opt.secretpath = 'projects/325574696734/secrets/Symplectic-Elements-FTP-ucdavis-password';

const sftp = new Client();

async function uploadFile(localFilePath, remoteFileName) {
  try {
    await sftp.connect(sftpConfig);
    console.log(localFilePath, remoteFilePath + remoteFileName);

    await sftp.put(fs.createReadStream(localFilePath), remoteFilePath + remoteFileName);

    console.log(`File uploaded successfully: ${localFilePath} -> ${remoteFilePath + remoteFileName}`);
  } catch (error) {
    console.error('Error uploading file:', error.message);
  } finally {
    await sftp.end();
  }
}


async function downloadFile(bucketName, fileName, destinationPath) {
  console.log(`Downloading file from GCS: ${fileName} -> ${destinationPath}`);
  console.log(`Bucket: ${bucketName}`);
  console.log(`File: ${fileName}`);
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  return new Promise((resolve, reject) => {
    try {
      console.log(`Downloading file from GCS: ${fileName} -> ${destinationPath}`);
      // Create a read stream from the file and pipe it to a local file
      const readStream = file.createReadStream();
      const writeStream = fs.createWriteStream(destinationPath);

      readStream.on('error', err => {
        console.error('Error reading stream:', err);
        reject(err);
      });

      writeStream.on('finish', () => {
        console.log(`File downloaded successfully to: ${destinationPath}`);
        resolve();
      });

      readStream.pipe(writeStream);
    } catch (error) {
      console.error('Error downloading file:', error.message);
      reject(error);
    }
  });
}


async function createGraphFromJsonLdFile(db, jsonld) {
  // Construct URL for uploading the data to the graph
  // Don't include a graphname to use what's in the jsonld file
  const url = `${db.url}/${db.db}/data`;

  // Set request options
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ld+json',
      'Authorization': `Basic ${db.authBasic}`
    },
    body: jsonld,
  };

  // Send the request to upload the data to the graph
  const response = await fetch(url, options);

  // Check if the request was successful
  if (!response.ok) {
    throw new Error(`Failed to create graph. Status code: ${response.status}` + response.statusText);
  }

  return await response.text();
}

async function executeUpdate(db, query) {
  // Construct URL for uploading the data to the graph
  // Don't include a graphname to use what's in the jsonld file
  const url = `${db.url}/${db.db}/update`;

  // Set request options
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sparql-update',
      'Authorization': `Basic ${db.authBasic}`
    },
    body: query,
  };


  // Send the request to upload the data to the graph
  const response = await fetch(url, options);

  // Check if the request was successful
  if (!response.ok) {
    throw new Error(`Failed execute update. Status code: ${response.status}` + response.statusText);
  }
  return await response.text();
}

async function executeCsvQuery(db, query) {
  // Construct URL for uploading the data to the graph
  // Don't include a graphname to use what's in the jsonld file
  const url = `${db.url}/${db.db}/query`;

  // Set request options
  const options = {
    method: 'POST',
    headers: {
      'Accept': 'text/csv',
      'Content-Type': 'application/sparql-query',
      'Authorization': `Basic ${db.authBasic}`
    },
    body: query,
  };

  // Send the request
  const response = await fetch(url, options);

  // Check if the request was successful
  if (!response.ok) {
    throw new Error(`Query Failed. Status code: ${response.status}` + response.statusText);
  }

  return await response.text();
}

function replaceHeaderHyphens(filename) {
  // Replace column headers underscores with dashes
  let data = fs.readFileSync(opt.output + "/" + filename, 'utf8');
  let lines = data.split('\n');
  lines[0] = lines[0].replace(/_/g, '-');
  let output = lines.join('\n');
  fs.writeFileSync(opt.output + "/" + filename, output);
}

async function main(opt) {

  // Ensure the output directory exists
  if (!fs.existsSync(opt.output)) {
    fs.mkdirSync(opt.output, { recursive: true });
  }
  // Start a fresh database
  let db = await fuseki.createDb(fuseki.db);

  // Where are we?
  console.log('Working dir: ' + __dirname);
  let localFilePath = opt.output + "/" + opt.source;

  // First download the file from GCS
  try {
    // Bucket where the file resides. Local file path to save the file to
    // Wait for the file to be completely written
    // console.log(localFilePath);
    await downloadFile(opt.bucket, opt.filePath, localFilePath);
    // The file has been completely written. You can proceed with your logic here.
  } catch (error) {
    console.error('Error:', error.message);
  }

  const xml = fs.readFileSync(localFilePath, 'utf8');

  // Convert the XML to JSON
  let json = parser.toJson(xml, { object: true, arrayNotation: false });
  console.log('JSON:', JSON.stringify(json).substring(0, 1000) + '...');

  // Create the JSON-LD context
  let contextObj = {
    "@context": {
      "@version": 1.1,
      "@base": "http://www.ucdavis.edu/aggie_enterprise/",
      "@vocab": "http://www.ucdavis.edu/aggie_enterprise#",
      "number": { "@id": "@id", "@type": "@id" },
      "principal_investigator": {
        "@context": {
          "number": { "@id": "id", "@type": "@id" }
        }
      },
      "organization_credit": {
        "@context": {
          "number": { "@id": "organization", "@type": "@id" }
        }
      },
      "flow_thru_funding": {
        "@context": {
          "@base": "http://rems.ucop.edu/sponsor/",
          "@vocab": "http://www.ucdavis.edu/aggie_enterprise#",
          "ucop_sponsor_code": { "@id": "@id", "@type": "@id" },
          "sponsor": "name"
        }
      },
      "funding_source": {
        "@context": {
          "@base": "http://rems.ucop.edu/sponsor/",
          "@vocab": "http://www.ucdavis.edu/aggie_enterprise#",
          "ucop_sponsor_code": { "@id": "@id", "@type": "@id" }
        }
      }
    }
  };

  contextObj["@graph"] = json["Document"]["award"];

  let jsonld = JSON.stringify(contextObj);
  fs.writeFileSync(opt.output + "/grants.jsonld", jsonld);

  // Create a graph from the JSON-LD file
  console.log(createGraphFromJsonLdFile(db, jsonld));

  // Apply the grants2vivo.rq SPARQL update to the graph
  const vivo = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/grants2vivo.rq', 'utf8');
  console.log(await executeUpdate(db, vivo));

  // Add the CDL-users graph to the fuseki database to include proprietary IDs
  // Command-line parameters to pass to the script
  const params = ['--cdl.groups=431', '--fuseki.db=aggie'];
  const result = spawnSync('node', [__dirname + '/experts-cdl-users.js', ...params], { encoding: 'utf8' });

  console.log('Output:', result.stdout);
  console.error('Error Output:', result.stderr);

  if (result.error) {
    console.error('Execution error:', result.error);
  }

  console.log('Exit code:', result.status);

  // Retrieve the SFTP password from GCS Secret Manager
  sftpConfig.password = await gs.getSecret(opt.secretpath);

  // Exexute the SPARQL query to to export the grants.csv file
  const grantQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/grants.rq', 'utf8');
  fs.writeFileSync(opt.output + "/grants.csv", await executeCsvQuery(db, grantQ));
  replaceHeaderHyphens("grants.csv");

  // Exexute the SPARQL query to to export the links.csv file
  const linkQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/links.rq', 'utf8');
  fs.writeFileSync(opt.output + "/links.csv", await executeCsvQuery(db, linkQ));
  replaceHeaderHyphens("links.csv");

  // Exexute the SPARQL query to to export the roles.csv file
  const roleQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/roles.rq', 'utf8');
  fs.writeFileSync(opt.output + "/roles.csv", await executeCsvQuery(db, roleQ));
  replaceHeaderHyphens("roles.csv");

  // Perform the SFTP upload
  await uploadFile(opt.output + "/links.csv", "links.csv");
  await uploadFile(opt.output + "/roles.csv", "persons.csv");
  await uploadFile(opt.output + "/grants.csv", "grants.csv");

}

await main(opt);
