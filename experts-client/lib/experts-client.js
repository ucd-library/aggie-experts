/**
 * @module experts-client
 * @version 1.0.0
 * @license MIT
 * @description Aggie Experts Client API provide methods to import and access Aggie Experts data.
 *
 */
'use strict';
import fs from 'fs';
import { EventEmitter, once } from 'node:events';
import fetch from 'node-fetch';

import { JsonLdParser } from "jsonld-streaming-parser";
import { Readable } from 'readable-stream';
import { QueryEngine } from '@comunica/query-sparql';

import { QueryEngine } from '@comunica/query-sparql';

import localDB from './localDB.js';

export { localDB };

/** Exports a class
 * @class
 * @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
 */
export class ExpertsClient {
    
    constructor(e,k) {
        // Simple constructor
        this.IamEndPoint = e;
        this.IamKey = k;
        
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
        const db = await localDB.create(db_config);
        
        /** Import the jsonld into the parser */
        await import_via_put();
        
        /** Parse ldJson into local db store */
        async function import_via_put() {
            
            myParser.import(Readable.from(ldJson))
            .on('error', console.error)
            .on('end', () => parsed())
            .on('data', data => {
                // console.log(data);
                db.store.put(data);
            });
            
            async function parsed() {
                console.log('All triples were parsed!');
                // const items = await db.store.get({});
                // await qstore_query();
                const opts = {
                    bind: 'PREFIX iam: <http://iam.ucdavis.edu/schema#> select ?s ?o where {graph ?g {?s iam:userID ?o}}',
                    source: db.store,
                    'construct@': './queries/iam_person_to_vivo.rq',
                }
                await splay(opts);
                
            }
            
        }
        
        async function qstore_query() {
            const q = new QueryEngine();
            
            console.log('qstore_query');
            
            // const sparql = fs.readFileSync('queries/iam_person_to_vivo.rq', 'utf8');
            // const output = fs.createWriteStream("vivo.jsonld");
            // const result = await engine.queryQuads(sparql, { sources: [db.store] })
            
            const stream = await q.queryBindings(`PREFIX iam: <http://iam.ucdavis.edu/schema#> select * where {graph ?g {?s iam:userID ?o}}`, { sources: [db.store] });
            stream.on('data', (binding) => {
                // Obtaining values
                console.log(binding.toString()); // Quick way to print bindings for testing
                // console.log(binding.get('s').value);
            });
            stream.on('end', () => console.log('end of quad stream'));
        }
        
        /**
         * @description
         * @param {
         * } cli 
         * @returns 
         * 
         */
        async function splay(cli) {
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
            
            const q = new QueryEngine();
            
            const bindingStream=await q.queryBindings(cli.bind,{sources: cli.source})
            bindingStream
            .on('data', async (bindings) => {
                if ( bindings.get('filename') && bindings.get('filename').value) {
                    const fn=bindings.get('filename').value
                    const quadStream = await q.queryQuads(cli.construct,{initialBindings:bindings, sources: cli.source});
                    if (frame) {
                        const quads = await quadStream.toArray();
                        console.log(`writing ${fn} with ${quads.length} quads`);
                        const doc=await jsonld.fromRDF(quads)
                        const framed=await jsonld.frame(doc,cli.frame,{omitGraph:false,safe:true})
                        if (bindings.get('uri')) {
                            framed['@id']=bindings.get('uri').value;
                        }
                        fs.writeFileSync(fn,JSON.stringify(framed,null,2));
                    } else {
                        const c = await q.query(construct,{initialBindings:bindings,sources: cli.source});
                        const {data} = await q.resultToString(c,'application/ld+json');
                        await fs.ensureFile(fn)
                        const writeStream = fs.createWriteStream(fn);
                        data.pipe(writeStream);
                        data.on('end', () => {
                            console.log('done writing '+fn);
                        });
                    }
                } else {
                    console.log('no filename');
                }
            })
            .on('error', (error) => {
                console.error(error);
            })
            .on('end', () => {
                console.log('bindings done');
            });
        }
    }
}    

export default ExpertsClient;
