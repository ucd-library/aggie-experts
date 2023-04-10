'use strict';
import fs from 'fs';
import { EventEmitter, once } from 'node:events';
import fetch from 'node-fetch';

import { JsonLdParser } from "jsonld-streaming-parser";
import { Readable } from 'readable-stream';

import localDB from './localDB.js';

export { localDB };

export class ExpertsClient {

    constructor(e,k) {
        // Simple constructor
        this.IamEndPoint = e;
        this.IamKey = k;

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

        // Create a jsonld parser
        const myParser = new JsonLdParser();

        // create a local database
        const db_config = {
            level: process.env.EXPERTS_LEVEL ?? 'ClassicLevel',
            path: process.env.EXPERTS_PATH ?? './iam_quadstore'
        }
        const db = await localDB.create(db_config);

        // Import the jsonld into the parser
        await import_via_put();

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
                await qstore_query();

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
    }

}

export default ExpertsClient;
