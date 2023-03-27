import { createReadStream } from 'fs';
import { JsonLdParser } from "jsonld-streaming-parser";
import { DataFactory } from 'rdf-data-factory';
import { Quadstore } from 'quadstore';
// import { Engine } from 'quadstore-comunica';
import { QueryEngine } from '@comunica/query-sparql';
import jsonld from 'jsonld';
import fs from 'fs';
import { Readable } from 'readable-stream';
import { ClassicLevel } from 'classic-level';

// get a jsonld doc
const doc = fs.readFileSync('faculty-sample.json', 'utf8');
const docObj = JSON.parse(doc).responseData.results;
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
async function import_via_put() {

    myParser.import(Readable.from(ldJson))
        .on('error', console.error)
        .on('end', () => parsed())
        .on('data', data => {
            qstore.put(data);
        });

    async function parsed() {
        console.log('All triples were parsed!');
        const items = await qstore.get({});
        //fs.writeFileSync('quadstore.json', JSON.stringify(items), 'utf8');

        qstore_query();
    }

}

 await import_via_put();

async function qstore_query() {

  console.log('qstore_query');

  const sparql = fs.readFileSync('./construct-vivo.sql', 'utf8');
//   const bindingsStream = await engine.queryBindings('SELECT * {graph ?g {?s ?p ?o}}');
   const result = await engine.query(sparql, { sources:[qstore] });
   const { data } = await engine.resultToString(result, 'application/ld+json');

var output = fs.createWriteStream("vivo.jsonld");
data.pipe(output);
}


