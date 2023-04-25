/**
 * @module experts-client
 * @version 1.0.0
 * @license MIT
 * @description Aggie Experts Client API provide methods to import and access Aggie Experts data.
 *
 */
'use strict';
import fs from 'fs';
import fetch from 'node-fetch';

import { JsonLdParser } from "jsonld-streaming-parser";
import { Readable } from 'readable-stream';
import { QueryEngine } from '@comunica/query-sparql';

import localDB from './localDB.js';

export { localDB };

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Instantiates a Secrets client
const client = new SecretManagerServiceClient();


/** Exports a class
 * @class
 * @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
 */
export class ExpertsClient {
    
    constructor(e) {
        // Simple constructor
        this.IamEndPoint = e;
        //console.log('contructed with ' + e); 
        this.IamKey = '';
    }
    
    async getSecret(name = 'projects/326679616213/secrets/ucdavis-iam-api-key') {
        const [secret] = await client.getSecret({
          name: name,
        });
        
        async function accessSecretVersion() {
          const [version] = await client.accessSecretVersion({
            name: name + '/versions/latest',
          });
          
          // Extract the payload as a string.
          const payload = version.payload.data.toString();
          
          // WARNING: Do not print the secret in a production environment - this
          // snippet is showing how to access the secret material.
        //   console.info(`Payload: ${payload}`);
          return payload.slice(4);
        //   console.log('getSecret ' + key);
        }
        return await accessSecretVersion();
    }
      
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
        var ldJson = '{"@context":' + JSON.stringify(context) + ',"@id":"http://iam.ucdavis.edu/", "@graph":' + JSON.stringify(docObj) + '}';
        
        /** Create a jsonld parser */
        const myParser = new JsonLdParser();
        
        /** create a local database */
        const db_config = {
            level: process.env.EXPERTS_LEVEL ?? 'ClassicLevel',
            path: process.env.EXPERTS_PATH ?? './iam_quadstore'
        }
        // const db = await this.getLocalDB(db_config);
        const db = await localDB.create({level:'ClassicLevel',path:'iam_quadstore'});
        
        /** Import the jsonld into the parser */
        await import_via_put();
        
        /** Parse ldJson into local db store */
        async function import_via_put() {
            
            myParser.import(Readable.from(ldJson))
            .on('error', console.error)
            .on('end', () => console.log('All triples were parsed and added to localdb!')) 
            .on('data', data => {
                // console.log(data);
                db.store.put(data);
            });            
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
            // usage('[options] <file...>')
            // description('Using a select, and a construct, splay a graph, into individual files.  Any files includes are added to a (potentially new) localdb before the construct is run.')
            // option('--bind <bind>', 'select query for binding')
            // option('--bind@ <bind.rq>', 'file containing select query for binding')
            // option('--construct <construct>', 'construct query for each binding')
            // option('--construct@ <construct.rq>', 'file containing construct query for each binding')
            // option('--frame <frame>', 'frame object for each binding')
            // option('--frame@ <frame.json>', 'file containing frame on the construct')
            // option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
            
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
            //const bindingStream=await q.queryBindings(cli.bind)
            bindingStream
              .on('data', async (bindings) => {
                let fn=1; // write to stdout by default
                console.log(bindings.toString());
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
              })
              .on('error', (error) => {
                console.error(error);
              })
              .on('end', () => {
                console.log('bindings done');
              });
            }
        
    }

export default ExpertsClient;
