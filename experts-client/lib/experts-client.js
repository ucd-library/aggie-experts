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

import fs from 'fs';
import fetch from 'node-fetch';
import { QueryEngine } from '@comunica/query-sparql';
import localDB from './localDB.js';
import { DataFactory } from 'rdf-data-factory';
import JsonLdProcessor from 'jsonld';

const jsonld=new JsonLdProcessor();

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
   */
  constructor() {
    console.log('ExpertsClient constructor');
    this.IamKey = process.env.EXPERTS_IAM_AUTH;
    this.IamEndPoint = process.env.EXPERTS_IAM_ENDPOINT;
    this.fusekiPw = process.env.EXPERTS_FUSEKI_AUTH;
    this.fusekiEndpoint = process.env.EXPERTS_FUSEKI_ENDPOINT;
    this.fusekiProfileSource = process.env.EXPERTS_FUSEKI_PROFILE_SOURCE;
    this.profileBind = process.env.EXPERTS_FUSEKI_PROFILE_BIND;
    this.profileConstruct = process.env.EXPERTS_FUSEKI_PROFILE_CONSTRUCT;
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
    
    const response = await fetch(this.IamEndPoint + '&key=' +this.IamKey);
    if (response.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
    }
    return response.json();
    
  }
  
  /** Parse returned profiles and store in local db */
  async processIAMProfiles() {
    
    // const doc = fs.readFileSync('faculty-sample.json', 'utf8');
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
    
  }
  
  /**
   * create fuseki dataset
   * http --auth=admin:testing123 POST http://localhost:3030/$/datasets dbName==iam_profiles dbType==tdb
   */
  async createDataset() {
    try {
      await fetch( this.fusekiEndpoint + '/$/datasets?dbName=iam_profiles&dbType=tdb', {
      method: 'POST',
      body: '[]',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + this.fusekiPw
      }
    }).then(res => res.text())
    .catch(err => console.log(err));
  } catch (err) {
      console.log(err);
  }
}

async createGraph() {
  try {
    
    // fs.writeFileSync('faculty.jsonld', this.jsonld);
    // const stats = fs.statSync("faculty.jsonld");
    // const fileSizeInBytes = stats.size;
    // var faculty = fs.readFileSync('faculty.jsonld', 'utf8');
    
    await fetch(this.fusekiEndpoint + '/iam_profiles/data', {
    method: 'POST',
    body: this.jsonld,
    headers: {
      'Content-Type': 'application/ld+json',
      'Authorization': 'Basic ' + this.fusekiPw
    }
  }).then(res => res.text())
  .catch(err => console.log(err));
}
catch (err) {
  console.log(err);
}
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
  
  console.log(cli);
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
    console.log('bindings done');
  });

async function construct_one(bindings) {
  await bindingStream.off('data', construct_one);
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
    quads.forEach((quad) => {
      quad.graph=graph;
    });
  }
  console.log(`writing ${fn} with ${quads.length} quads`);
  let doc=await jsonld.fromRDF(quads)

  if (frame) {
    doc=await jsonld.frame(doc,cli.frame,{omitGraph:false,safe:true})
  } else {
    //      doc=await jsonld.expand(doc,{omitGraph:false,safe:true})
  }
  fs.writeFileSync(fn,JSON.stringify(doc,null,2));
  await bindingStream.on('data', construct_one);
}
}

}

export default ExpertsClient;
