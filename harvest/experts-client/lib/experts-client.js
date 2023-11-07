/**
* @module experts-client
* @version 1.0.0
* @license MIT
* @description Aggie Experts Client API provide methods to import and access Aggie Experts data.
*
*/
'use strict';

import fs from 'fs-extra';
import fetch from 'node-fetch';
import { QueryEngine } from '@comunica/query-sparql';
import { DataFactory } from 'rdf-data-factory';
import JsonLdProcessor from 'jsonld';
import { nanoid } from 'nanoid';
import path from 'path';
import parser from 'xml2json';
import { count } from 'console';

const jp = new JsonLdProcessor();

import readablePromiseQueue from './readablePromiseQueue.js';

/** Exports a class
* @class
* @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
*/
export class ExpertsClient {

  /**
  * @constructor
  * Accepts a opt object with options from a commander program.
  */
  constructor(opt) {
    //    console.log('ExpertsClient constructor');
    this.opt = opt;
    this.experts = [];
  }

  async getIAMProfiles(opt, scope) {

    let url = encodeURI(opt.iam.url + 'people/profile/search?key=' + opt.iam.auth);
    // add a user(cas) id(s) to the iam endpoint if specified
    if (scope === 'users' && opt.users.length > 0) {
      url += '&userId=' + opt.users;
    }
    // if no specified users, then add the staff or the faculty flag
    else if (scope === 'faculty') {
      url += '&isFaculty=true';
    }
    else if (scope === 'staff') {
      url += '&isStaff=true';
    }
    else {
      throw new Error(`No IAM query scope specified.`);
      return
    }

    const response = await fetch(url);

    if (response.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
    }
    else if (response.status === 200) {
      let respJson = await response.json();
      // console.log(this.doc);
      if (respJson == null) {
        throw new Error(`No profiles returned from IAM.`);
      }
      this.experts = this.experts.concat(respJson.responseData.results);
    }
    return
  }

  /** jsonld-ify an JSON object */
  async createJsonLd(input, context, graphId) {

    context["@id"] = graphId;
    context["@graph"] = input;
    return context;
  }


  static str_or_file(opt, param, required) {
    if (opt[param]) {
      return opt[param];
    } else if (opt[param + '@']) {
      opt[param] = fs.readFileSync(opt[param + '@'], 'utf8');
      return opt[param];
    } else if (required) {
      console.error('missing required option: ' + param + '(@)');
      process.exit(1);
    } else {
      return null;
    }
  }

  /**
  * @description
  * @param {
  * } opt
  * @returns
  *
  */
  async insert(opt) {
    const bind = ExpertsClient.str_or_file(opt, 'bind', true);
    const insert = ExpertsClient.str_or_file(opt, 'insert', true);

    const q = new QueryEngine();

    async function insertBoundConstruct(bindings) {
      // if opt.bindings, add them to bindings
      if (opt.bindings) {
        for (const [key, value] of opt.bindings) {
          bindings = bindings.set(key, value);
        }
      }
      // comunica's initialBindings function doesn't work,
      //so this is a sloppy workaround
      let insert = opt.insert;
      for (const [key, value] of bindings) {
        if (value.termType === 'Literal') {
          insert = insert.replace(new RegExp(`\\?${key.value}`, 'g'), `"${value.value}"`);
        } else if (value.termType === 'NamedNode') {
          insert = insert.replace(new RegExp('\\?' + key.value, 'g'), `<${value.value}>`);
        }
      }
      opt.insert = insert;
      const promise = opt.db.update(insert);
      return promise;
    }

    const bindingStream = q.queryBindings(opt.bind, { sources:[opt.db.source()] })

    const queue = new readablePromiseQueue(bindingStream, insertBoundConstruct,
      { name: 'insert', max_promises: 10 });
    return queue.execute({ via: 'start' });
  }


  /**
* @description
* @param {
* } opt
* @returns
*
*/
  async splay(opt) {
    const bind = ExpertsClient.str_or_file(opt, 'bind', true);
    const construct = ExpertsClient.str_or_file(opt, 'construct', true);
    const frame = ExpertsClient.str_or_file(opt, 'frame', false)
    const context = ExpertsClient.str_or_file(opt, 'context', false)
    if (opt.frame) {
      if (typeof opt.frame === 'string') {
        opt.frame = JSON.parse(opt.frame);
      }
      if (opt.context) {
        const context = JSON.parse(opt.context);
        opt.context = JSON.parse(opt.context);
        opt.frame['@context'] = opt.context['@context'];
      }
    }

    const q = new QueryEngine();
    const factory = new DataFactory();

    // console.log(opt)

    async function constructRecord(bindings) {
      let fn = 1; // write to stdout by default
      if (bindings.get('filename') && bindings.get('filename').value) {
        if (opt.output) {
          fn = path.join(opt.output, bindings.get('filename').value);
        } else {
          fn = bindings.get('filename').value
        }
        bindings = bindings.delete('filename');
      }
      // comunica's initialBindings function doesn't work,
      //so this is a sloppy workaround
      let construct = opt.construct;
      for (const [key, value] of bindings) {
        if (value.termType === 'Literal') {
          construct = construct.replace(new RegExp(`\\?${key.value}`, 'g'), `"${value.value}"`);
        } else if (value.termType === 'NamedNode') {
          construct = construct.replace(new RegExp('\\?' + key.value, 'g'), `<${value.value}>`);
        }
      }
      const quadStream = await q.queryQuads(construct, { sources: [opt.db.source()] });

      // convert construct to jsonld quads
      const quads = await quadStream.toArray();
      let doc = await jp.fromRDF(quads)
      if (frame) {
        doc = await jp.frame(doc, opt.frame, { omitGraph: false, safe: false, ordered: true });
      } else {
        doc = await jp.expand(doc, { omitGraph: false, safe: false, ordered: true });
      }
      console.log(`writing ${fn} with ${quads.length} quads`);
      fs.ensureFileSync(fn);
      fs.writeFileSync(fn, JSON.stringify(doc, null, 2));
    }

    const bindingStream = q.queryBindings(opt.bind, { sources: [opt.db.source()],fetch })
    const queue = new readablePromiseQueue(bindingStream, constructRecord,
      { name: 'splay', max_promises: 5 });
    return queue.execute({ via: 'start' });

  }

  /**
   * @description Modify a frame to include a graph match.  If for whatever reason the document has multiple graphs this will select one. I don't think this is needed
   * @param doc - jsonld document
   **/
  async graphify(doc, frame, graph) {
    frame['@context'] = (frame['@context'] instanceof Array ? frame['@context'] : [frame['@context']])
    frame['@context'].push({ "@base": graph.value });
    frame['@id'] = graph.value;

    doc = await jp.frame(doc, opt.frame, { omitGraph: true, safe: false })
    doc['@context'] = [
      "info:fedora/context/experts.json",
      { "@base": graph.value }];

  }

  /**
 * @description Generic function to get all the entries from a CDL collection
 * @param {
  * } opt
  * @returns
  *
  */
  async getCDLentries(opt, query) {
    const cdl = opt.cdl;
    var lastPage = false
    var results = [];
    var nextPage = path.join(cdl.url, query)
    var count = 0;

    if (cdl.auth.match(':')) {
      cdl.authBasic = Buffer.from(cdl.auth).toString('base64');
    } else {
      cdl.authBasic = cdl.auth;
    }

    while (nextPage) {
      console.log(`getting ${nextPage}`);
      const response = await fetch(nextPage, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + cdl.authBasic,
          'Content-Type': 'text/xml'
        }
      })

      if (response.status !== 200) {
        throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
        break;
      }
      else if (response.status === 200) {

        const xml = await response.text();
        count++;
        // convert the xml atom feed to json
        const json = parser.toJson(xml, { object: true, arrayNotation: false });

        // add the entries to the results array
        if (json.feed.entry) {
          results = results.concat(json.feed.entry);
        }

        // inspect the pagination to see if there are more pages
        const pagination = json.feed['api:pagination'];

        // Fetch the next page
        nextPage = null;

        if (pagination["api:page"] instanceof Array) {
          for (let link of pagination["api:page"]) {
            if (link.position === 'next') {
              nextPage = link.href;
            }
          }
        }
      }
    }

    return results;
  }


  /**
 * @description Generic function to get all the entries from a CDL collection and post them to a fuseki database
 * @param {
  * } opt
  * @returns
  *
  */
  async getPostCDLentries(opt, query, cdlId, context) {
    const cdl = opt.cdl;
    const db = opt.db;
    let lastPage = false
    let nextPage = `${cdl.url}/${query}`
    let count = 0;

    if (cdl.auth.match(':')) {
      cdl.authBasic = Buffer.from(cdl.auth).toString('base64');
    } else {
      cdl.authBasic = cdl.auth;
    }

    function truncate(work) {
      foreach record in work['api:relationship']?.['api:related']?.['api:records']?.['api:record'] {
        console.log(`record: ${record.id}`);
      }
      //?.['api:native']}?.['api.field']?.['api:people']?.['api:person']?.['api:name']?.['api:display']`);
      return work;
    }

    while (nextPage) {
      let results = [];
      let entries = [];

      console.log(`getting ${nextPage}`);
      const response = await fetch(nextPage, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + cdl.authBasic,
          'Content-Type': 'text/xml'
        }
      })

      if (response.status !== 200) {
        throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
        break;
      }

      const xml = await response.text();
      count++;

      // convert the xml atom feed to json
      const json = parser.toJson(xml, { object: true, arrayNotation: false });

      // Bad writing here
      fs.writeFileSync(`${cdlId}-${count}-orig.json`,JSON.stringify(json));

      // add the entries to the results array
      if (json.feed.entry) {

        entries = entries.concat(json.feed.entry);
        for (let work of entries) {
          let related = [];
          if (work['api:relationship'] && work['api:relationship']['api:related']) {
            if (opt.truncate) {
              related.push(truncate(work['api:relationship']['api:related']))
            } else {
              related.push(work['api:relationship']['api:related'])
            }
            work['api:relationship'] ||= {};
            work['api:relationship']['api:related'] = related;
            results.push(work['api:relationship']);
        }

        // Create the JSON-LD for the user relationships
        // save a text version of the context object
        let contextObj = context;

        contextObj["@id"] = 'http://oapolicy.universityofcalifornia.edu/';
        contextObj["@graph"] = results;

        let jsonld = JSON.stringify(contextObj);
        console.log('posting relationships of ' + cdlId);

        // Bad writing here
        fs.writeFileSync(`${cdlId}-${count}.json`,jsonld);

        // Insert into our local Fuseki DB
        await db.createGraphFromJsonLdFile(jsonld);
      }

      // inspect the pagination to see if there are more pages
      const pagination = json.feed['api:pagination'];

      // Fetch the next page
      nextPage = null;

      if (pagination["api:page"] instanceof Array) {
        for (let link of pagination["api:page"]) {
          if (link.position === 'next') {
            nextPage = link.href;
          }
        }
      }
    }
    return;
  }
}

export default ExpertsClient;
