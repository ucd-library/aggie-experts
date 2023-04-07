'use strict';
import fs from 'fs';
import { EventEmitter, once } from 'node:events';
import fetch from 'node-fetch';

// localdb info
import { JsonLdParser } from "jsonld-streaming-parser";
import { DataFactory } from 'rdf-data-factory';
import { Quadstore } from 'quadstore';
import { QueryEngine } from '@comunica/query-sparql';
import { Readable } from 'readable-stream';
import { ClassicLevel } from 'classic-level';
import { MemoryLevel } from 'memory-level';

import localDB from './localDB.js';

export { localDB };

export class ExpertsClient {

     constructor(opts) {
      this.doc = '';
      this.opts=opts;
      // we probably need to await this though, so not in the constructor?
      //this.store = new localStore(options);

      this.IamEndPoint = opts.IAM.endPoint;
      this.IamKey = opts.IAM.key
    }

  async getLocalDB(options) {
    if (!this.store) {
      this.store = localDB.create({ ...this.opts.localDB, ...options });
    }
    return this.store;
  }

    async getIAMProfiles() {
        
        const response = await fetch(this.IamEndPoint + '&key=' +this.IamKey);
        if (response.status !== 200) {
            throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
        }
        return response.json();

    }

    async processDoc() {

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
        
        // fs.writeFileSync('faculty.jsonld', ldJson);

        // Create a jsonld parser
        const myParser = new JsonLdParser();

        // Any implementation of AbstractLevel can be used.
        const backend = new ClassicLevel('./db', { valueEncoding: 'json' });

        // Implementation of the RDF/JS DataFactory interface
        const df = new DataFactory();
        // Store and query engine are separate modules
        const qstore = new Quadstore({ backend, dataFactory: df });
        const engine = new QueryEngine();

        // Open the store
        await qstore.open();

        // Import the jsonld into the parser
        await import_via_put();

        async function import_via_put() {

            myParser.import(Readable.from(ldJson))
            .on('error', console.error)
            .on('end', () => parsed())
            .on('data', data => {
                // console.log(data);
                qstore.put(data);
            });

            async function parsed() {
                console.log('All triples were parsed!');
                // const items = await qstore.get({});
                await qstore_query();

            }

        }

        async function qstore_query() {

            console.log('qstore_query');
            
            const sparql = fs.readFileSync('experts-client/construct-vivo.sql', 'utf8');
            
            const output = fs.createWriteStream("vivo.jsonld");
            
            // const result = await engine.queryQuads(sparql, { sources: [qstore] })

            const stream = await engine.queryBindings(`
            PREFIX iam: <http://iam.ucdavis.edu/schema#> select * where {graph ?g {?s iam:userID ?o}}`, { sources: [qstore] });
            // stream.on('data', (bindings) => console.log(bindings)); 
            stream.on('data', (binding) => {
                console.log(binding.toString()); // Quick way to print bindings for testing
                // Obtaining values
                console.log('loop');
                console.log(binding.get('s').value);
            });        

            // console.log(result.resultType);
            
            // const data  = await engine.resultToString(result, 'application/ld+json');
            // var i = 0;
            // result.on('data', (quad) => {
            //     // console.log(quad.predicate.value);
            //     if (quad.predicate.value === 'http://experts.ucdavis.edu/schema#casId') {
            //         console.log(quad.object.value);
            //     }
            // });
            // result.on('data', (chunk) => {
            //     console.log(chunk.toString());
            //     i++;
            // });
            // console.log(i);
            //data.pipe(output);
            
        }
    }

}

export default ExpertsClient;
