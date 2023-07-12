/**
* @module query-library
* @version 1.0.0
* @license MIT
* @description Provides access to saved queries.
*/
'use strict';

import fs from 'fs-extra';
import path from 'path';
import JsonLdProcessor from 'jsonld';

import * as url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export class queryLibrary {
  constructor(opts) {
    this.opts = opts;
    return this;
  }

  async load() {
    const jsonld = new JsonLdProcessor();
    const querydb=fs.readJsonSync(path.join(__dirname, 'query.jsonld.json'));
    querydb['@context'] = (querydb['@context'] instanceof Array ? querydb['@context'] : [querydb['@context']])
    querydb['@context'].push({"@base":path.join(__dirname, 'query', '/')});
    //const expand = await jsonld.expand(querydb);
    //console.log(JSON.stringify(expand,2));
    const frame={
      "@version": 1.1,
      "@context":{
        "@vocab":"http://schema.library.ucdavis.edu/schema#",
        "experts":"http://experts.ucdavis.edu/",
        "insert@" : {
          "@id":"insert@",
          "@type":"@id"
        },
        "frame@" : {
          "@id":"frame@",
          "@type":"@id"
        },
        "context@" : {
          "@id":"context@",
          "@type":"@id"
        },
        "construct@" : {
          "@id":"construct@",
          "@type":"@id"
        },
        "bind@" : {
          "@id":"bind@",
          "@type":"@id"
        }
      },
      "@type":["SplayQuery","InsertQuery"]
    };
    const doc=await jsonld.frame(querydb,frame,{omitGraph:false,safe:false});
    // console.log(doc);
    this.query=doc;
    return this;
  }

  getSplay(splayName) {
    const id=path.join(__dirname, 'query', '/', splayName);
    for(let i=0;i<this.query['@graph'].length;i++) {
      if(this.query['@graph'][i]['@id']===id) {
        return this.query['@graph'][i];
      }
    }
    return null;
  }

  getQuery(name,type=null) {
    const id=path.join(__dirname, 'query', '/', name);
    for(let i=0;i<this.query['@graph'].length;i++) {
      if((this.query['@graph'][i]['@id']===id)) { // &&
//         (type===null || this.query['@graph'][i]['@type']===type)) {
          return this.query['@graph'][i];
        }
    }
    return null;
  }


}

export default queryLibrary;
