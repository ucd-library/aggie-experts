/**
* @module experts-client
* @version 1.0.0
* @license MIT
* @description Aggie Experts Client API provide methods to import and access Aggie Experts data.
*
*/
'use strict';
// import * as dotenv from 'dotenv';
// dotenv.config();

import fs from 'fs-extra';
import fetch from 'node-fetch';
import { QueryEngine } from '@comunica/query-sparql';
import localDB from './localDB.js';
import { DataFactory } from 'rdf-data-factory';
import JsonLdProcessor from 'jsonld';
import { nanoid } from 'nanoid';
import path from 'path';

const jsonld = new JsonLdProcessor();

// import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export { localDB };

// Instantiates a Secrets client
// const client = new SecretManagerServiceClient();

/** Exports a class
* @class
* @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
*/
export class ExpertsClient {

  /**
  * @constructor
  * Accepts a opt object with options from a commander program.
  */
  constructor(opt) {
    console.log('ExpertsClient constructor');
    this.opt = opt;
  }

  /** Return a local db */
  async getLocalDB(options) {
    if (!this.store) {
      this.store = localDB.create({ ...this.opt.localDB, ...options });
    }
    return this.store;
  }

  /** Fetch Researcher Profiles from the UCD IAM API */
  async getIAMProfiles(opt) {

    opt.iamEndpoint += '?isFaculty=true';
    opt.iamEndpoint += '&key=' + opt.iamAuth;
    // add a single user id to the iam endpoint if specified
    if (opt.userId != null) {
      opt.iamEndpoint += '&userId=' + opt.userId;
    }

    console.log(opt.iamEndpoint);

    const response = await fetch(opt.iamEndpoint);

    if (response.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
    }
    else if (response.status === 200) {
      this.doc = await response.json();
      if (this.doc.responseData.results == null) {
        throw new Error(`No profiles returned from IAM.`);
      }
    }

    return

  }

  /** Parse returned profiles and store in local db */
  async processIAMProfiles(opt) {

    const docObj = this.doc.responseData.results;
    const context = {
      "@Version": 1.1,
      "@base": "http://iam.ucdavis.edu/",
      "@vocab": "http://iam.ucdavis.edu/schema#",
      "iamId": "@id",
      "orgOId": "@id",
      "bouOrgOId": {
        "@type": "@id"
      },
      "iam": "http://iam.ucdavis.edu/schema#",
      "harvest_iam": "http://iam.ucdavis.edu/"
    };
    this.jsonld = '{"@context":' + JSON.stringify(context) + ',"@id":"http://iam.ucdavis.edu/", "@graph":' + JSON.stringify(docObj) + '}';

    fs.writeFileSync('faculty.jsonld', this.jsonld);
  }

  /**
   * This could easily be joined w/ createDataset, and called mkDb and we only specify temp id if we done't have a name
   **/
  async mkFusekiTmpDb(opt, files) {
    const fuseki = opt.fuseki;
    if (!fuseki.url) {
      throw new Error('No Fuseki url specified');
    }
    if (!fuseki.auth) {
      throw new Error('No Fuseki auth specified');
    }
    // You can still specify a db name if you want, otherwise we'll generate a
    // random one
    if (fuseki.auth.match(':')) {
      fuseki.auth = Buffer.from(fuseki.auth).toString('base64');
    }
    if (!fuseki.db) {
      fuseki.db = nanoid(5);
      fuseki.isTmp = true;
      fuseki.type = fuseki.type || 'mem';
    }
    console.log(fuseki);


    // just throw the error if it fails
    const res = await fetch(path.join(fuseki.url, '$', 'datasets'),
      {
        method: 'POST',
        body: new URLSearchParams({ 'dbName': fuseki.db, 'dbType': fuseki.type }),
        headers: {
          'Authorization': `Basic ${fuseki.auth}`
        }

      });
    // const text = await res.text();
    // console.log(text);
    if (res.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${res.status}`);
    }
    if (files) {
      fuseki.files = await this.addToFusekiDb(opt, files);
    }
    return fuseki;
  }

  /**
   * upload file to fuseki.  We unambiguousely specify the fuseki endpoint.
   And right now, you can't specify a default graph name for the jsonld file.
   */
  async addToFusekiDb(opt, files) {
    const fuseki = opt.fuseki;
    files instanceof Array ? files : [files]
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // const jsonld = fs.readFileSync(file);
      // Be good to have verbose output better NDJSON for debugging
      const res = await fetch(`${fuseki.url}/${fuseki.db}/data`, {
        method: 'POST',
        body: this.jsonld,
        headers: {
          'Authorization': `Basic ${fuseki.auth}`,
          'Content-Type': 'application/ld+json'
        }
      })
      const json = await res.json();
      const log = {
        file: file,
        status: res.status,
        response: json
      };
      results.push(log);
    }
    return results;
  }

  async dropFusekiDb(opt) {
    const fuseki = opt.fuseki;
    if ((fuseki.isTmp || opt.force)
      && (fuseki.url && fuseki.db)) {
      const res = await fetch(`${fuseki.url}/\$/datasets/${fuseki.db}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${fuseki.auth}`
          }
        })
      return res.status;
    }
  }

  async createDataset(opt) {
    const fuseki = opt.fuseki;
    if (fuseki.auth.match(':')) {
      fuseki.auth = Buffer.from(fuseki.auth).toString('base64');
    }

    const res = await fetch(`${fuseki.url}/\$/datasets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${fuseki.auth}`
        },
        body: new URLSearchParams({ 'dbName': fuseki.db, 'dbType': fuseki.type }),
      })
    return res.status;
  }

  async createGraphFromJsonLdFile(opt) {
    const fuseki = opt.fuseki;
    // Read JSON-LD file from file system
    // const jsonLdFileContent = fs.readFileSync(jsonLdFilePath, 'utf-8');

    // Construct URL for uploading the data to the graph
    // Don't include a graphname to use what's in the jsonld file
    const url = `${fuseki.url}/${fuseki.db}/data`;

    // Set request options
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ld+json',
        'Authorization': `Basic ${fuseki.auth}`
      },
      body: this.jsonld,
    };

    // Send the request to upload the data to the graph
    console.log(url);
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Failed to create graph. Status code: ${response.status}`);
    }

    return await response.text();
  }

  /**
  * @description
  * @param {
  * } opt
  * @returns
  *
  */
  async splay(opt) {

    function str_or_file(opt, param, required) {
      if (opt[param]) {
        return opt[param];
      } else if (opt[param + '@']) {
        opt[param] = fs.readFileSync(opt[param + '@'], 'utf8').replace(/\r|\n/g, '');
        return opt[param];
      } else if (required) {
        console.error('missing required option: ' + param + '(@)');
        process.exit(1);
      } else {
        return null;
      }
    }

    // console.log(opt);
    const bind = str_or_file(opt, 'bind', true);
    const construct = str_or_file(opt, 'construct', true);
    const frame = str_or_file(opt, 'frame', false)
    if (opt.frame) {
      opt.frame = JSON.parse(opt.frame);
    }

    let q;
    let sources = null;
    if (opt.quadstore) {
      const db = await localDB.create({ level: 'ClassicLevel', path: opt.quadstore });
      //  opt.source=[db];
      q = new Engine(db.store);
      sources = null;
    } else {
      q = new QueryEngine();
      sources = opt.source;
    }


    const factory = new DataFactory();

    console.log(opt)
    const bindingStream = await q.queryBindings(opt.bind, { sources: opt.source })
    console.log('bindingStream created')

    bindingStream.on('data', construct_one)
      .on('error', (error) => {
        console.error(error);
      })
      .on('end', () => {
        // console.log('bindings done');
      });

    let binding_count = 0;

    async function construct_one(bindings) {
      // binding_count++;
      // if (binding_count > 20) {
      //   console.log('too many bindings.  Stop listening');
      //   await bindingStream.off('data', construct_one);
      // }
      let fn = 1; // write to stdout by default
      if (bindings.get('filename') && bindings.get('filename').value) {
        if (opt.output) {
          fn = path.join(opt.output, bindings.get('filename').value);
        } else {
          fn = bindings.get('filename').value
        }
      }
      // convert construct to jsonld quads
      const quadStream = await q.queryQuads(opt.construct, { initialBindings: bindings, sources: opt.source });
      const quads = await quadStream.toArray();
      let doc = await jsonld.fromRDF(quads)

      if (frame) {
        doc = await jsonld.frame(doc, opt.frame, { omitGraph: false, safe: true })
      } else {
        doc = await jsonld.expand(doc, { omitGraph: false, safe: true })
      }
      console.log(`writing ${fn} with ${quads.length} quads`);
      fs.ensureFileSync(fn);
      fs.writeFileSync(fn, JSON.stringify(doc, null, 2));
      // binding_count--;
      // if (binding_count < 10) {
      //   console.log('too few bindings.  start listening');
      //   await bindingStream.on('data', construct_one);
      // }
    }
    return true;
  }

  /**
   * @description Modify a frame to include a graph match.  If for whatever reason the document has multiple graphs this will select one. I don't think this is needed
   * @param doc - jsonld document
   **/
  async graphify(doc, frame, graph) {
    frame['@context'] = (frame['@context'] instanceof Array ? frame['@context'] : [frame['@context']])
    frame['@context'].push({ "@base": graph.value });
    frame['@id'] = graph.value;

    doc = await jsonld.frame(doc, opt.frame, { omitGraph: true, safe: true })
    doc['@context'] = [
      "info:fedora/context/experts.json",
      { "@base": graph.value }];

  }
}
export default ExpertsClient;
