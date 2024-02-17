#!/usr/bin/env node
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
  .requiredOption('-b, --bucket <bucket>', 'GCS bucket name')
  .requiredOption('-s, --source <source>', 'Source file path in GCS')
  .requiredOption('-o, --output <output>', 'Local output file path')
  .requiredOption('-h, --host <host>', 'SFTP server hostname')
  .requiredOption('-u, --username <username>', 'SFTP username')
  .requiredOption('-d, --db <db>', 'Fuseki database name')
  .requiredOption('-p, --prefix <prefix>', 'Remote file prefix')
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
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  return new Promise((resolve, reject) => {
    try {
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


async function main(opt) {

  // Start a fresh database
  let db = await fuseki.createDb(fuseki.db);

  // Where are we?
  console.log('Working dir: ' + __dirname);
  let localFilePath = opt.output + "/" + opt.source;

  // First download the file from GCS
  try {
    // Bucket where the file resides. Local file path to save the file to
    // Wait for the file to be completely written
    await downloadFile(opt.bucket, 'grants/' + opt.source, localFilePath);
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
  // console.log('JSON:', JSON.stringify(contextObj).substring(0, 1000) + '...');

  let jsonld = JSON.stringify(contextObj);

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
  // Perform the SFTP upload
  uploadFile(opt.output + "/grants.csv", opt.prefix + "-grants.csv");

  // Exexute the SPARQL query to to export the links.csv file
  const linkQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/links.rq', 'utf8');
  fs.writeFileSync(opt.output + "/links.csv", await executeCsvQuery(db, linkQ));
  // Perform the SFTP upload
  uploadFile(opt.output + "/links.csv", opt.prefix + "-links.csv");

  // Exexute the SPARQL query to to export the roles.csv file
  const roleQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/roles.rq', 'utf8');
  fs.writeFileSync(opt.output + "/roles.csv", await executeCsvQuery(db, roleQ));
  // Perform the SFTP upload
  uploadFile(opt.output + "/roles.csv", opt.prefix + "-researchers.csv");

}

await main(opt);
