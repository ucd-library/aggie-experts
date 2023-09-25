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
import { frames } from '@ucd-lib/experts-api';

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
    const querydb=fs.readJsonSync(path.join(__dirname, 'queries.json'));
    querydb['@context'] = (querydb['@context'] instanceof Array ? querydb['@context'] : [querydb['@context']])
    querydb['@context'].push({"@base":path.join(__dirname, 'query', '/')});
    //const expand = await jsonld.expand(querydb);
    //console.log(JSON.stringify(expand,2));
    const query_frame={
      "@version": 1.1,
      "@context":{
        "@vocab":"http://schema.library.ucdavis.edu/schema#",
        "experts":"http://experts.ucdavis.edu/",
        "insert@" : {
          "@id":"insert@",
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
    const doc=await jsonld.frame(querydb,query_frame,{omitGraph:false,safe:false});
    this.queries=doc['@graph'];
    return this;
  }

  getSplay(splayName) {
    const id=path.join(__dirname, 'query', '/', splayName);
    for(let i=0;i<this.queries.length;i++) {
      if(this.queries[i]['@id']===id) {
        this.queries.frame=frames.default;
        return this.queries[i];
      }
    }
    return null;
  }

  getQuery(name,type=null) {
    const id=path.join(__dirname, 'query', '/', name);
    for(let i=0;i<this.queries.length;i++) {
      if((this.queries[i]['@id']===id)) { // &&
//         (type===null || this.queries[i]['@type']===type)) {
          return this.queries[i];
        }
    }
    return null;
  }


}

export default queryLibrary;
