#!/usr/bin/env node

/* Transform the Aggie Enterprise grant feed into VIVO RDF and create CSV file for Symplectic import
   rakunkel@ucdavis.edu */

import fs from 'fs';
import { Command } from '../lib/experts-commander.js';
import { Storage } from '@google-cloud/storage';
import parser from 'xml2json';

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exit, versions } from 'process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .version('1.0.0')
  .description('Upload a file to a remote SFTP server')
  .option('--env <env>', '', 'QA')
  .option('--debug', 'Debug mode')
  .requiredOption('-xml, --xml <xml>', 'Source file path in GCS')
  .requiredOption('-o, --output <output>', 'Local output file path')
  // .option('--fuseki.delete', 'Delete the fuseki.db after running', fuseki.delete)
  // .option('--no-fuseki.delete')
  .option('-g, --generation <generation>', 'GCS (XML) file generation', 0)
  .option_fuseki()
  .option_log()
  .parse(process.argv);

let opt = await program.opts();

opt.fuseki.log = opt.log;
const log = opt.log;

if (opt.env === 'PROD') {
  opt.prefix = 'Prod_UCD_';
} else if (opt.env === 'QA') {
  opt.prefix = '';
} else {
  opt.prefix = '';
}

opt.db = 'ae-grants';

let outputSubDirectory = opt.output + '/generation-' + opt.generation + '/';

// Write to
if (opt.debug) console.log('Output subdirectory:', outputSubDirectory);

// Ensure the output directory exists
if (!fs.existsSync(outputSubDirectory)) {
  fs.mkdirSync(outputSubDirectory, { recursive: true });
}

// fusekize opt
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^fuseki./, '')
  if (n !== k) {
    fuseki[n] = opt[k];
    delete opt[k];
  }
});


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
  if (opt.debug) console.log(`File Name: ${opt.fileName}`);
  if (opt.debug) console.log(`Bucket: ${bucketName}`);
  if (opt.debug) console.log(`File: ${filePath}`);
}

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
            if (opt.debug) console.log(`File: ${file.name}, Generation: ${file.metadata.generation}`);
          }
        });

        // Sort the generations in descending order and take the first two
        // resolve(xmlGenerations.sort((a, b) => b - a).slice(0, 2));
        resolve(xmlGenerations.sort((a, b) => b - a));
      });
    }
    catch (err) {
      log.error('Error getting file versions:', err);
      reject(err);
    }
  });
}

async function downloadFile(bucketName, fileName, destinationPath, generation) {

  if (opt.debug) console.log(`Downloading file ${fileName} ${generation} from bucket ${bucketName} to ${destinationPath}`);

  const bucket = storage.bucket(bucketName);
  const meta = bucket.file(fileName);

  return new Promise((resolve, reject) => {
    try {
      const versionedFile = bucket.file(fileName, { generation: generation });
      versionedFile.download()
        .then((data) => {
          if (opt.debug) console.log(`Downloaded version ${generation} of file ${fileName}`);
                // Write the file to the local file system
          fs.writeFileSync(destinationPath, data.toString());
          resolve();
        })
        .catch((err) => {
          log.error(`Failed to download version ${generation} of file ${fileName}:`, err);
          reject(err);
        }
        );
    }
    catch (err) {
      log.error('Error downloading file:', err);
      reject(err);
    }
  });
}

async function createGraphFromJsonLdFile(db, jsonld, graphName) {
  // Construct URL for uploading the data to the graph
  // Don't include a graphname to use what's in the jsonld file
  // const url = `${db.url}/${db.db}/data?graph=${encodeURIComponent(graphName)}`;
  const url = `${db.url}/${db.db}/data`;
  if (opt.debug) console.log('Creating graph from JSON-LD file...');

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

  // Start a fresh database
  let db = await opt.fuseki.createDb(opt.db,opt);

  // Ensure the output directory exists
  if (!fs.existsSync(outputSubDirectory + "/xml")) {
    fs.mkdirSync(outputSubDirectory + "/xml", { recursive: true });
  }
  let localFilePath = outputSubDirectory + "/xml/" + opt.fileName;
  if (opt.debug) console.log('Local XML file path:', localFilePath);

  if (opt.debug) console.log('Downloading file from GCS:', opt.filePath);

  // First get an array of file versions from GCS. 0 is the current version, 1 is the previous version, etc.
  const fileVersions = await getXmlVersions(opt.bucket, opt.filePath);

  // Download the file version asked for from GCS
  await downloadFile(opt.bucket, opt.filePath, localFilePath, fileVersions[opt.generation]);
  const xml = fs.readFileSync(localFilePath, 'utf8');

  // Convert the XML to JSON
  let json = parser.toJson(xml, { object: true, arrayNotation: false });

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
  fs.writeFileSync(outputSubDirectory + "/grants.jsonld", jsonld);

  // Create a graph from the JSON-LD file
  if (opt.debug) console.log('Creating graph from JSON-LD file ' + graphName + '...');
  await createGraphFromJsonLdFile(db, jsonld, graphName);

  // Apply the grants2vivo.ru SPARQL update to the graph
  const vivo = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/grants2vivo.ru', 'utf8');
  if (opt.debug) console.log(await executeUpdate(db, vivo));

  // Exexute the SPARQL queries to to export the csv files
  const grantFile = outputSubDirectory + '/' + opt.prefix + 'grants_metadata.csv';
  const grantQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/grants.rq', 'utf8');
  fs.writeFileSync(grantFile, await executeCsvQuery(db, grantQ, graphName));
  replaceHeaderHyphens(grantFile);

  const linkFile = outputSubDirectory + '/' + opt.prefix + 'grants_links.csv';
  const linkQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/links.rq', 'utf8');
  fs.writeFileSync(linkFile, await executeCsvQuery(db, linkQ, graphName));
  replaceHeaderHyphens(linkFile);

  const roleFile = outputSubDirectory + '/' + opt.prefix + 'grants_persons.csv';
  const roleQ = fs.readFileSync(__dirname.replace('bin', 'lib') + '/query/grant_feed/roles.rq', 'utf8');
  fs.writeFileSync(roleFile, await executeCsvQuery(db, roleQ, graphName));
  replaceHeaderHyphens(roleFile);

}

await main(opt);
