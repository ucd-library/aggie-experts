'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import { nanoid } from 'nanoid';
// import JSONStream from 'JSONStream';
import { Transform, Readable, Writable } from 'stream';

import { DataFactory } from 'rdf-data-factory';
import { BindingsFactory } from '@comunica/bindings-factory';

import ExpertsClient from '../lib/experts-client.js';
import QueryLibrary from '../lib/query-library.js';
import { GoogleSecret } from '@ucd-lib/experts-api';

const DF = new DataFactory();
const BF = new BindingsFactory();

const ql = await new QueryLibrary().load();
const gs = new GoogleSecret();

console.log('starting experts-cdl-fetch');

const program = new Command();

// This also reads data from .env file via dotenv
const fuseki = {
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  type: 'mem',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
};

const cdl = {
  url: '',
  auth: '',
  secretpath: '',
};

async function main(opt) {

  // get the secret JSON
  let secretResp = await gs.getSecret(opt.cdl.secretpath);
  let secretJson = JSON.parse(secretResp);
  for (const entry of secretJson) {
    if (entry['@id'] == opt.cdl.authname) {
      opt.cdl.auth = entry.auth.raw_auth;
    }
  }

  // console.log('opt', opt);

  const ec = new ExpertsClient(opt);


  const context = {
    "@context": {
      "@base": "http://oapolicy.universityofcalifornia.edu/",
      "@vocab": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "oap": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "api": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "id": { "@type": "@id", "@id": "@id" },
      "field-name": "api:field-name",
      "field-number": "api:field-number",
      "$t": "api:field-value",
      "api:person": { "@container": "@list" },
      "api:first-names-X": { "@container": "@list" },
      "api:web-address": { "@container": "@list" }
    }
  };

  var uquery = 'users?detail=ref&per-page=1000';
  var sinceFilter = '';


  var relationshipsContext = JSON.stringify(context);
  let contextObj = context;


  // fetch all relations for user. Note that the may be grants, etc.
  ec.works = [];
  let works = await ec.getCDLentries(opt, 'users/' + opt.userId + '/relationships?detail=full');
  // return;

  for (let work of works) {
    let related = [];
    if (work['api:relationship'] && work['api:relationship']['api:related']) {
      related.push(work['api:relationship']['api:related']);
    }
    related.push({ direction: 'to', id: cdlId, category: 'user' });
    work['api:relationship'] ||= {};
    work['api:relationship']['api:related'] = related;
    ec.works.push(work['api:relationship']);
  }

  console.log(ec.works.length + ' works found for ' + user);
  console.log('starting createJsonLd ' + user);

  // Create a Readable stream from the JSON object so we can transform one object at a time
  class ObjectStream extends Readable {
    constructor(array) {
      super({ objectMode: true }); // Enable object mode
      this.array = array;
      this.currentIndex = 0;
    }

    _read() {
      if (this.currentIndex < this.array.length) {
        // Push the next object into the stream
        this.push(this.array[this.currentIndex]);
        this.currentIndex++;
      } else {
        // No more objects to push, signal the end of the stream
        this.push(null);
      }
    }
  }

  const objectStream = new ObjectStream(ec.works);

  objectStream.on('end', () => {
    console.log('Stream ended.');
  });

  // Create a custom Transform stream to convert JSON to text
  const jsonToTextStream = new Transform({
    writableObjectMode: true,
    transform(chunk, encoding, callback) {
      try {
        // Convert the object to text and push it into the pipeline
        this.push(JSON.stringify(chunk) + ',');
        callback();
      }
      catch (err) {
        callback(err);
        console.log('error in jsonToTextStream' + err.message);
      }
    },
  });

  // Create a custom Writable stream to accumulate text data into a variable
  let textVariable = '';
  const textAccumulatorStream = new Writable({
    write(chunk, encoding, callback) {
      try {
        // Accumulate the text chunks into a variable
        textVariable += chunk.toString();
        callback();
      }
      catch (err) {
        callback(err);
        console.log('error in textAccumulatorStream' + err.message);
      }
    },
  });

  // Pipe the JSON object through the JSON to text converter
  jsonToTextStream.pipe(textAccumulatorStream);

  // Start streaming the JSON object
  // jsonToTextStream.write(ec.works);
  objectStream.pipe(jsonToTextStream);

  // When done, end the streams
  // jsonToTextStream.end();

  textAccumulatorStream.on('error', (err) => {
    console.error(err);
  });

  textAccumulatorStream.on('finish', () => {
    // Create the JSON-LD for the user relationships

    // remove the ending bracket
    jsonld = relationshipsContext.slice(0, -1);
    jsonld += ',\n"@id": "http://oapolicy.universityofcalifornia.edu/"';
    jsonld += ',\n"@graph": [';
    jsonld += textVariable.slice(0, -1);
    jsonld += '\n]}';

    fs.writeFileSync(path.join(__dirname, '../data', user + '.jsonld'), jsonld);
    putJsonLd(jsonld);
  });

  console.log('starting works createGraph ' + user);
  async function putJsonLd(jsonld) {
    await ec.createGraphFromJsonLdFile(jsonld, opt);
  }

  // Any other value don't delete
  if (opt.fuseki.isTmp === true && !opt.saveTmp) {
    const dropped = await ec.dropFusekiDb(opt);
  }
}

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).replace('/bin', '/lib');


program.name('cdl-profile')
  .usage('[options] <users...>')
  .description('Import CDL Researcher Profiles and Works')
  .option('--source <source...>', 'Specify linked data source. Used instead of --fuseki')
  .option('--output <output>', 'output directory')
  .option('--userId <userId>', 'Specify CDL ID')
  .option('--cdl.url <url>', 'Specify CDL endpoint', cdl.url)
  .option('--cdl.groups <groups>', 'Specify CDL group ids', cdl.groups)
  .option('--cdl.affected <affected>', 'affected since')
  .option('--cdl.modified <modified>', 'modified since')
  .option('--cdl.auth <user:password>', 'Specify CDL authorization', cdl.auth)
  .option('--experts-service <experts-service>', 'Experts Sparql Endpoint', 'http://localhost:3030/experts/sparql')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', true)
  .option('--fuseki.type <type>', 'specify type on --fuseki.isTmp creation', 'tdb')
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify db on --fuseki.isTmp creation.  If not specified, a random db is generated', fuseki.db)
  .option('--save-tmp', 'Do not remove temporary file', false)
  .option('--environment <env>', 'specify environment', 'production')
  .option('--nosplay', 'skip splay', false)


program.parse(process.argv);

let opt = program.opts();

// fusekize opt
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^fuseki./, '')
  if (n !== k) {
    opt.fuseki ||= {};
    opt.fuseki[n] = opt[k];
    delete opt[k];
  }
});

// make cdl_info as object
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^cdl\./, '')
  if (n !== k) {
    opt.cdl ||= {};
    opt.cdl[n] = opt[k];
    delete opt[k];
  }
});

if (opt.environment === 'development') {
  opt.cdl.url = 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5';
  opt.cdl.authname = 'qa-oapolicy';
  opt.cdl.secretpath = 'projects/326679616213/secrets/cdl_elements_json';
}
else if (opt.environment === 'production') {
  opt.cdl.url = 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5';
  opt.cdl.authname = 'oapolicy';
  opt.cdl.secretpath = 'projects/326679616213/secrets/cdl_elements_json';
}

// console.log('opt', opt);
await main(opt);
