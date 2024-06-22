#!/usr/bin/env node

/* Transform the Aggie Enterprise grant feed into VIVO RDF and upload to the Symplectic server
   rakunkel@ucdavis.edu */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { spawnSync } from 'child_process';
import FusekiClient from '../lib/fuseki-client.js';
import { Storage } from '@google-cloud/storage';
import { GoogleSecret } from '@ucd-lib/experts-api';
import parser from 'xml2json';
import { logger } from '../lib/logger.js';


const gs = new GoogleSecret();

const program = new Command();

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exit, versions } from 'process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


program
  .version('1.0.0')
  .description('Upload a file to a remote SFTP server')
  .option('--env <env>', '', 'QA')
  .requiredOption('-xml, --xml <xml>', 'Source file path in GCS')
  .requiredOption('-o, --output <output>', 'Local output file path')
  .option('--upload', 'Upload the file to the SFTP server')
  .option('--fuseki <db>', 'Fuseki database name', 'ae-grants')
  .option('-r, --remote <remote>', 'Remote file path on the Symplectic server')
  .option('-g, --generation <generation>', 'GCS (XML) file generation', 0)
  .parse(process.argv);

let opt = program.opts();

if (opt.env === 'PROD') {
  opt.prefix = 'Prod_UCD_';
} else if (opt.env === 'QA') {
  opt.prefix = '';
} else {
  opt.prefix = '';
}

opt.output += '/generation-' + opt.generation;

logger.info('Options:', opt);

const graphName = 'http://www.ucdavis.edu/aggie_enterprise_' + opt.generation

const storage = new Storage();

// GCS storage
// XML file to be downloaded from GCS and converted to JSON
// If xml starts with gs://, download the file from GCS
if (opt.xml.startsWith('gs://')) {
  const [, , bucketName, ...filePathParts] = opt.xml.split('/');
  const filePath = filePathParts.join('/');
  opt.bucket = bucketName;
  opt.filePath = filePath;
  // get the file name from the path
  opt.fileName = filePathParts[filePathParts.length - 1];
  logger.info(`File Name: ${opt.fileName}`);
  logger.info(`Bucket: ${bucketName}`);
  logger.info(`File: ${filePath}`);
}

const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb2',
  db: opt.fuseki || 'aggie',
  replace: true,
  'delete': false,
});

async function getXmlVersions(bucketName, fileName) {
  const bucket = storage.bucket(bucketName);
  const xmlGenerations = [];

  return new Promise((resolve, reject) => {
    try {
      bucket.getFiles({
        versions: true,
        // prefix: fileName
      }, function (err, files) {
        // Each file is scoped to its generation.
        files.forEach(function (file) {
          if (file.name == fileName) {
            xmlGenerations.push(file.metadata.generation);
            logger.info(`File: ${file.name}, Generation: ${file.metadata.generation}`);
          }
        });

        // Sort the generations in descending order and take the first two
        // resolve(xmlGenerations.sort((a, b) => b - a).slice(0, 2));
        resolve(xmlGenerations.sort((a, b) => b - a));
      });
    }
    catch (err) {
      console.error('Error getting file versions:', err);
      logger.error('Error getting file versions:', err);
      reject(err);
    }
  });
}

async function downloadFile(bucketName, fileName, destinationPath, generation) {

  logger.info(`Downloading file ${fileName} ${generation} from bucket ${bucketName} to ${destinationPath}`);

  const bucket = storage.bucket(bucketName);
  const meta = bucket.file(fileName);

  return new Promise((resolve, reject) => {
    try {
      const versionedFile = bucket.file(fileName, { generation: generation });
      versionedFile.download()
        .then((data) => {
          logger.info(`Downloaded version ${generation} of file ${fileName}`);
                // Write the file to the local file system
          fs.writeFileSync(destinationPath, data.toString());
          resolve();
        })
        .catch((err) => {
          console.error(`Failed to download version ${generation} of file ${fileName}:`, err);
          logger.error(`Failed to download version ${generation} of file ${fileName}:`, err);
          reject(err);
        }
        );
    }
    catch (err) {
      console.error('Error downloading file:', err);
      logger.error('Error downloading file:', err);
      reject(err);
    }
  });
}

async function createGraphFromJsonLdFile(db, jsonld, graphName) {
  // Construct URL for uploading the data to the graph
  // Don't include a graphname to use what's in the jsonld file
  // const url = `${db.url}/${db.db}/data?graph=${encodeURIComponent(graphName)}`;
  const url = `${db.url}/${db.db}/data`;
  logger.info('Creating graph from JSON-LD file...');

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

async function executeCsvQuery(db, query, graphName) {
  // Construct URL for uploading the data to the graph
  // Don't include a graphname to use what's in the jsonld file
  // const url = `${db.url}/${db.db}/query?graph=${encodeURIComponent(graphName)}`;
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
    return response.statusText;
  }

  return await response.text();
}

function replaceHeaderHyphens(filename) {
  // Replace column headers underscores with dashes
  let data = fs.readFileSync(filename, 'utf8');
  let lines = data.split('\n');
  lines[0] = lines[0].replace(/_/g, '-');
  let output = lines.join('\n');
  fs.writeFileSync(filename, output);
}

async function main(opt) {

  // Ensure the output directory exists
  if (!fs.existsSync(opt.output)) {
    fs.mkdirSync(opt.output, { recursive: true });
  }
  // Start a fresh database
  let db = await fuseki.createDb(fuseki.db);

  // Ensure the output directory exists
  if (!fs.existsSync(opt.output + "/xml")) {
    fs.mkdirSync(opt.output + "/xml", { recursive: true });
  }
  let localFilePath = opt.output + "/xml/" + opt.fileName;
  logger.info('Local XML file path:', localFilePath);

  logger.info('Downloading file from GCS:', opt.filePath);

  // First get an array of file versions from GCS. 0 is the current version, 1 is the previous version, etc.
  const fileVersions = await getXmlVersions(opt.bucket, opt.filePath);
  console.log('File versions:', fileVersions);

  // Download the file version asked for from GCS
  await downloadFile(opt.bucket, opt.filePath, localFilePath, fileVersions[opt.generation]);
  const xml = fs.readFileSync(localFilePath, 'utf8');

  // Convert the XML to JSON
  let json = parser.toJson(xml, { object: true, arrayNotation: false });
  // console.log('JSON:', JSON.stringify(json).substring(0, 1000) + '...');

  // Create the JSON-LD context
  let contextObj = {
    "@context": {
      "@version": 1.1,
      "@base": "http://www.ucdavis.edu/aggie_enterprise/",
      "@vocab": "http://www.ucdavis.edu/aggie_enterprise#",
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
  console.log('Creating graph from JSON-LD file ' + graphName + '...');
  logger.info('Creating graph from JSON-LD file ' + graphName + '...');
  console.log(createGraphFromJsonLdFile(db, jsonld, graphName));

  // Apply the grants2vivo.ru SPARQL update to the graph
  const vivo = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/grants2vivo.ru', 'utf8');
  console.log(await executeUpdate(db, vivo));

  // Exexute the SPARQL queries to to export the csv files
  const grantFile = opt.output + '/' + opt.prefix + 'grants_metadata.csv';
  const grantQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/grants.rq', 'utf8');
  fs.writeFileSync(grantFile, await executeCsvQuery(db, grantQ, graphName));
  replaceHeaderHyphens(grantFile);

  const linkFile = opt.output + '/' + opt.prefix + 'grants_links.csv';
  const linkQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/links.rq', 'utf8');
  fs.writeFileSync(linkFile, await executeCsvQuery(db, linkQ, graphName));
  replaceHeaderHyphens(linkFile);

  const roleFile = opt.output + '/' + opt.prefix + 'grants_persons.csv';
  const roleQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/roles.rq', 'utf8');
  fs.writeFileSync(roleFile, await executeCsvQuery(db, roleQ, graphName));
  replaceHeaderHyphens(roleFile);

}

await main(opt);
