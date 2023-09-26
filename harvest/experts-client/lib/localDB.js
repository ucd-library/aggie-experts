'use strict';
import fs from 'fs';
import { EventEmitter, once } from 'node:events';

// localdb info
import { JsonLdParser } from "jsonld-streaming-parser";
import { DataFactory } from 'rdf-data-factory';
import { Quadstore } from 'quadstore';
import { ClassicLevel } from 'classic-level';
import { MemoryLevel } from 'memory-level';


export class localDB {
  /**
     This async constructor method taken from dev.to/somedood/the-proper-way-to-write-async-constructors-in-javascript-1o8c

    * @private
    */
  constructor(opts) {
    const defaults = {
      path: './db',
      level: 'ClassicLevel',
      level_opts: { valueEncoding: 'json' },
        };

    this.opts = { ...defaults, ...opts};
    console.log('options:',this.opts);

    var backend;
    switch(this.opts.level) {
    case 'Classic':
    case 'ClassicLevel':
      backend=new ClassicLevel(this.opts.path,this.opts.level_opts);
      break;
    case 'MEM':
    case 'MemoryLevel':
      backend = new MemoryLevel(this.opts.level_opts);
      break;
    default:
      throw new Error('Unknown level backend');
    }
    this.parser = new JsonLdParser();
    const df = new DataFactory();
    const store = new Quadstore({ backend, dataFactory: df });
    this.store = store;
  }

  static async create(opts) {
    const db = new localDB(opts);
    await db.store.open();
    return db;
  }


  async load(files) {
    Array.isArray(files) || (files = [files]);
    console.log('loading files:',files);
    return Promise.all(files.map((fn) => {
      console.log("Reading file: "+fn);
      let stream=this.store.import(this.parser.import(fs.createReadStream(fn)));
      return once(stream, 'end');
    }))
  }

  match(query) {
    return this.store.match(query);
  }

  async close() {
    await this.store.close();
  }

}

export default localDB;
