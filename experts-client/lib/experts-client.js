/**
* @module experts-client
* @version 1.0.0
* @license MIT
* @description Aggie Experts Client API provide methods to import and access Aggie Experts data.
*
*/
'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs-extra';
import fetch from 'node-fetch';
import { QueryEngine } from '@comunica/query-sparql';
import localDB from './localDB.js';
import { DataFactory } from 'rdf-data-factory';
import JsonLdProcessor from 'jsonld';
import { nanoid } from 'nanoid';

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
  * Accepts a cli object with options from a commander program.
  */
  constructor(cli) {

    // console.log(cli);

    // console.log('ExpertsClient constructor');

    // This needs to be moved to a config.js class
    // Accept CLI options for these values if they are provided. Defaults are set in the .env file.
    cli.iamAuth ??= process.env.EXPERTS_IAM_AUTH;
    cli.iamEndpoint ??= process.env.EXPERTS_IAM_ENDPOINT;
    cli.fusekiEndpoint = process.env.EXPERTS_FUSEKI_ENDPOINT;
    cli.fusekiAuth ??= process.env.EXPERTS_FUSEKI_AUTH;
    cli.fusekiPW ??= process.env.EXPERTS_FUSEKI_PW;
    cli.fusekiUser ??= process.env.EXPERTS_FUSEKI_USER;
    cli.fusekiDataset ??= process.env.EXPERTS_FUSEKI_DATASET;
    cli.source ??= process.env.EXPERTS_FUSEKI_ENDPOINT + process.env.EXPERTS_FUSEKI_PROFILE_SOURCE + '/sqarql';

    // console.log(cli);

    this.cli = cli;

  }

  // async getSecret(name) {
  //   const [secret] = await client.getSecret({
  //     name: name,
  //   });

  //   async function accessSecretVersion() {
  //     const [version] = await client.accessSecretVersion({
  //       name: name + '/versions/latest',
  //     });

  //     // Extract the payload as a string.
  //     const payload = version.payload.data.toString();

  //     // WARNING: Do not print the secret in a production environment - this
  //     // snippet is showing how to access the secret material.
  //     //   console.info(`Payload: ${payload}`);
  //     return payload.slice(4);
  //     //   console.log('getSecret ' + key);
  //   }
  //   return await accessSecretVersion();
  // }

  /** Return a local db */
  async getLocalDB(options) {
    if (!this.store) {
      this.store = localDB.create({ ...this.opts.localDB, ...options });
    }
    return this.store;
  }

  /** Fetch Researcher Profiles from the UCD IAM API */
  async getIAMProfiles() {

    const response = await fetch(this.cli.iamEndpoint + '&key=' + this.cli.iamAuth);
    console.log(this.cli.iamEndpoint + '&key=' + this.cli.iamAuth);

    // console.log(response)

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
  async processIAMProfiles() {

    // const doc = fs.readFileSync('faculty-sample.json', 'utf8');
    // const docObj = doc;
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
   * create fuseki dataset
   */
  async createDataset(dbName, dbType) {
    try {
      await fetch( this.cli.iamEndpoint + '/$/datasets?dbName=' + dbName + '&dbType=' + dbType, {
        method: 'POST',
        body: '[]',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + this.cli.fusekiAuth
        }
      }).then(res => res.text())
        .catch(err => console.log(err));
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * This could easily be joined w/ createDataset, and called mkDb and we only specify temp id if we done't have a name
   **/
  async mkFusekiTmpDb(opt,files) {
    const fuseki=opt.fuseki;
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
    if (!fuseki.db ) {
      fuseki.db=nanoid(5);
      fuseki.isTmp=true;
      fuseki.type= fuseki.type || 'mem';
    }
    // just throw the error if it fails
    const res = await fetch(`${fuseki.url}/\$/datasets`,
                            {
                              method: 'POST',
                              body:new URLSearchParams({'dbName': fuseki.db,'dbType': fuseki.type}),
                              headers: {
                                'Authorization': `Basic ${fuseki.auth}`
                              }
                            });

    fuseki.files = await this.addToFusekiDb(opt,files);
    return fuseki;
  }

  /**
   * upload file to fuseki.  We unambiguousely specify the fuseki endpoint.
   And right now, you can't specify a default graph name for the jsonld file.
   */
  async addToFusekiDb(opt,files) {
    const fuseki=opt.fuseki;
    files instanceof Array ? files : [files]
    const results = [];
    for (let i=0; i<files.length; i++) {
      const file = files[i];
      const jsonld=fs.readFileSync(file);
      // Be good to have verbose output better NDJSON for debugging
      const res = await fetch(`${fuseki.url}/${fuseki.db}/data`, {
        method: 'POST',
        body: jsonld,
        headers: {
          'Authorization': `Basic ${fuseki.auth}`,
          'Content-Type': 'application/ld+json'
        }
      })
      const json = await res.json();
      const log={
        file:file,
        status:res.status,
        response:json
      };
      results.push(log);
    }
    return results;
  }

  async dropFusekiDb(opt) {
    const fuseki=opt.fuseki;
    if ((fuseki.isTmp || opt.force)
        && (fuseki.url && fuseki.db)) {
      const res = await fetch(`${fuseki.url}/\$/datasets/${fuseki.db}`,
                              { method: 'DELETE',
                              headers: {
                                'Authorization': `Basic ${fuseki.auth}`
                              }
                              })
      return res.status;
    }
  }

  async createGraph(dataset) {
  try {

    await fetch(this.cli.source + '/' + dataset + '/data', {
    method: 'POST',
    body: this.jsonld,
    headers: {
      'Content-Type': 'application/ld+json',
      'Authorization': 'Basic ' + this.cli.fusekiAuth

  async createDataset(datasetName, fusekiUrl, username, password) {

    const auth = {
      user: username,
      pass: password,
    };

    const url = `${fusekiUrl}/$/datasets`;
    console.log(url);
    const body = new URLSearchParams({
      dbName: datasetName,
      dbType: 'tdb2',
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString('base64')}`,
      },
      body,
    };

    const response = await fetch(url, options);
    // console.log(response);

    if (!response.ok) {
      throw new Error(`Failed to create dataset. Status code: ${response.statusText}`);
    }

    return await response.text();
  }



  async createGraphFromJsonLdFile(datasetName, jsonLdFilePath, fusekiUrl, username, password) {
    // Read JSON-LD file from file system
    const jsonLdFileContent = fs.readFileSync(jsonLdFilePath, 'utf-8');

    // Construct URL for uploading the data to the graph
    // Don't include a graphname to use what's in the jsonld file
    const url = `${fusekiUrl}/${datasetName}/data`;
    //   const url = `${fusekiUrl}/${datasetName}/data?graph=${graphName}`;

    // Set authentication options
    const auth = {
      user: username,
      pass: password,
    };

    // Set request options
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ld+json',
        'Authorization': `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString('base64')}`,
      },
      body: jsonLdFileContent,
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
* } cli
* @returns
*
*/
  async splay(cli) {

    function str_or_file(opt,param,required) {
      if (opt[param]) {
        return opt[param];
      } else if (opt[param+'@']) {
        opt[param]=fs.readFileSync(opt[param+'@'],'utf8');
        return opt[param];
      } else if (required) {
        console.error('missing required option: '+param+'(@)');
        process.exit(1);
      } else {
        return null;
      }
    }

    // console.log(cli);
    const bind = str_or_file(cli,'bind',true);
    const construct = str_or_file(cli,'construct',true);
    const frame = str_or_file(cli,'frame',false)
    if (cli.frame) {
      cli.frame=JSON.parse(cli.frame);
    }

    let q;
    let sources=null;
    if (cli.quadstore) {
      const db = await localDB.create({level:'ClassicLevel',path:cli.quadstore});
      //  cli.source=[db];
      q = new Engine(db.store);
      sources=null;
    } else {
      q = new QueryEngine();
      sources=cli.source;
    }

    const factory=new DataFactory();

    const bindingStream=await q.queryBindings(cli.bind,{sources: cli.source})
    bindingStream.on('data', construct_one )
      .on('error', (error) => {
        console.error(error);
      })
      .on('end', () => {
        // console.log('bindings done');
      });

    let binding_count=0;

    async function construct_one(bindings) {
      // binding_count++;
      // if (binding_count > 20) {
      //   console.log('too many bindings.  Stop listening');
      //   await bindingStream.off('data', construct_one);
      // }
      let fn=1; // write to stdout by default
      if ( bindings.get('filename') && bindings.get('filename').value) {
        fn=bindings.get('filename').value
      }
      let graph = null;
      if (bindings.get('graph')) {
        graph=factory.namedNode(bindings.get('graph').value);
      }

      // convert construct to jsonld quads
      const quadStream = await q.queryQuads(cli.construct,{initialBindings:bindings, sources: cli.source});
      const quads = await quadStream.toArray();
      if (graph) {
        // console.log('graph: '+graph.value);
        quads.forEach((quad) => {
          quad.graph=graph;
        });
      }
      let doc=await jsonld.fromRDF(quads)

      if (frame) {
        cli.frame['@context']['@base']=graph.value;
        cli.frame['@id']=graph.value;
        doc=await jsonld.frame(doc,cli.frame,{omitGraph:true,safe:true})
        // doc['@id']='';
        // doc['@context']=["info:fedora/context/experts.json",{"@base":graph.value}];
        doc['@context']="info:fedora/context/experts.json";
        //console.log('framed',doc);
      } else {
        //      doc=await jsonld.expand(doc,{omitGraph:false,safe:true})
      }
      console.log(`writing ${fn} with ${quads.length} quads`);
      fs.ensureFileSync(fn);
      fs.writeFileSync(fn,JSON.stringify(doc,null,2));
      // binding_count--;
      // if (binding_count < 10) {
      //   console.log('too few bindings.  start listening');
      //   await bindingStream.on('data', construct_one);
      // }
    }
    return true;
  }

}

export default ExpertsClient;
