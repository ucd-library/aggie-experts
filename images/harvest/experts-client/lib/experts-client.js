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

// Instantiates a Secrets client
// const client = new SecretManagerServiceClient();

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
  }

  /** Fetch Researcher Profiles from the UCD IAM API */
  // async getIAMProfiles(opt) {
  /** Fetch Researcher Profiles from the CDL Elements API */

  // }

  async getIAMProfiles(opt) {

    opt.iamEndpoint += '?isFaculty=true';
    opt.iamEndpoint += '&key=' + opt.iamAuth;
    // add a single user id to the iam endpoint if specified
    if (opt.userId != null) {
      opt.iamEndpoint += '&userId=' + opt.userId;
    }

    opt.iamEndpoint = encodeURI(opt.iamEndpoint + '?key=' + opt.iamAuth + '&isFaculty=true');
    const response = await fetch(opt.iamEndpoint);

    if (response.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
    }
    else if (response.status === 200) {
      this.doc = await response.json();
      // console.log(this.doc);
      this.doc = this.doc.responseData.results;
      if (this.doc == null) {
        throw new Error(`No profiles returned from IAM.`);
      }
    }
    return
  }

  /** jsonld-ify an JSON object */
  async createJsonLd(input, context, graphId) {

    context["@id"] = graphId;
    context["@graph"] = input;
    return context;
  }

  /**
   * This could easily be joined w/ createDataset, and called mkDb and we only specify temp id if we done't have a name
   **/
  async mkFusekiTmpDb(opt, files) {
    const fuseki = opt.fuseki;
    if (!fuseki.url) {
      throw new Error('No Fuseki url specified');
    }
    if (!fuseki.auth) {
      throw new Error('No Fuseki auth specified');
    }
    // You can still specify a db name if you want, otherwise we'll generate a
    // random one
    if (fuseki.auth.match(':')) {
      fuseki.authBasic = Buffer.from(fuseki.auth).toString('base64');
    } else {
      fuseki.authBasic = fuseki.auth;
    }
    if (!fuseki.db) {
      fuseki.db = nanoid(5);
      fuseki.isTmp = true;
      fuseki.type = fuseki.type || 'mem';
    }
    //    console.log(fuseki);


    // just throw the error if it fails
    const res = await fetch(path.join(fuseki.url, '$', 'datasets'),
      {
        method: 'POST',
        body: new URLSearchParams({ 'dbName': fuseki.db, 'dbType': fuseki.type }),
        headers: {
          'Authorization': `Basic ${fuseki.authBasic}`
        }

      });
    // const text = await res.text();
    // console.log(text);
    if (res.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${res.status}`);
    }
    if (files) {
      fuseki.files = await this.addToFusekiDb(opt, files);
    }
    return fuseki;
  }

  /**
   * upload file to fuseki.  We unambiguousely specify the fuseki endpoint.
   And right now, you can't specify a default graph name for the jsonld file.
   */
  async addToFusekiDb(opt, files) {
    const fuseki = opt.fuseki;
    files instanceof Array ? files : [files]
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const jsonld = fs.readFileSync(file);
      // Be good to have verbose output better NDJSON for debugging
      const res = await fetch(`${fuseki.url}/${fuseki.db}/data`, {
        method: 'POST',
        body: jsonld,
        headers: {
          'Authorization': `Basic ${fuseki.authBasic}`,
          'Content-Type': 'application/ld+json'
        }
      })
      const json = await res.json();
      const log = {
        file: file,
        status: res.status,
        response: json
      };
      results.push(log);
    }
    return results;
  }

  async dropFusekiDb(opt) {
    const fuseki = opt.fuseki;
    if ((fuseki.isTmp || opt.force)
      && (fuseki.url && fuseki.db)) {
      const res = await fetch(`${fuseki.url}/\$/datasets/${fuseki.db}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${fuseki.authBasic}`
          }
        })
      return res.status;
    }
  }

  async createDataset(opt) {
    const fuseki = opt.fuseki;
    if (fuseki.auth.match(':')) {
      fuseki.authBasic = Buffer.from(fuseki.auth).toString('base64');
    } else {
      fuseki.authBasic = fuseki.auth;
    }

    const res = await fetch(`${fuseki.url}/\$/datasets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${fuseki.authBasic}`
        },
        body: new URLSearchParams({ 'dbName': fuseki.db, 'dbType': fuseki.type }),
      })
    return res.status;
  }

  async createGraphFromJsonLdFile(jsonld, opt) {
    const fuseki = opt.fuseki;
    // Read JSON-LD file from file system
    // const jsonLdFileContent = fs.readFileSync(jsonLdFilePath, 'utf-8');

    // Construct URL for uploading the data to the graph
    // Don't include a graphname to use what's in the jsonld file
    const url = `${fuseki.url}/${fuseki.db}/data`;

    // Set request options
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ld+json',
        'Authorization': `Basic ${fuseki.authBasic}`
      },
      body: jsonld,
    };

    // Send the request to upload the data to the graph
    //    console.log(url);
    const response = await fetch(url, options);

    // console.log(response);

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`Failed to create graph. Status code: ${response.status}`);
    }

    return await response.text();
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

    async function execFusekiUpdate(opt, query) {
      const fuseki = opt.fuseki;
      const url = `${fuseki.url}/${fuseki.db}/update`;

      // Set request options
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-update',
          'Authorization': `Basic ${fuseki.authBasic}`
        },
        body: query,
      };

      const response = await fetch(url, options);

      if (!response.ok) {
        // console.log(response);
        throw new Error(`Failed to execute update. Status code: ${response.status}`);
      }

      return await response.text();
    }

    const bind = ExpertsClient.str_or_file(opt, 'bind', true);
    const insert = ExpertsClient.str_or_file(opt, 'insert', true);

    const q = new QueryEngine();
    const sources = opt.source;

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
      const update = opt.source[0].replace(/sparql$/, 'update');

      const promise = execFusekiUpdate(opt, insert);
      // const promise = q.queryVoid(insert, { sources: [update], httpAuth: opt.fuseki.auth });

      return promise;

    }

    const bindingStream = q.queryBindings(opt.bind, { sources, fetch: fetch })

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
      opt.frame = JSON.parse(opt.frame);
      if (opt.context) {
        const context = JSON.parse(opt.context);
        opt.context = JSON.parse(opt.context);
        opt.frame['@context'] = opt.context['@context'];
      }
    }

    const q = new QueryEngine();
    const sources = opt.source;
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
      const quadStream = await q.queryQuads(construct, { sources: opt.source });
      //      const quadStream = await q.queryQuads(construct, { initialBindings: bindings, sources: opt.source });

      // convert construct to jsonld quads
      const quads = await quadStream.toArray();
      let doc = await jp.fromRDF(quads)
      if (frame) {
        //        doc = await jp.frame(doc, opt.frame, { omitGraph: false, safe: true })
        doc = await jp.frame(doc, opt.frame, { omitGraph: true, safe: true })
      } else {
        doc = await jp.expand(doc, { omitGraph: false, safe: true })
      }
      console.log(`writing ${fn} with ${quads.length} quads`);
      fs.ensureFileSync(fn);
      fs.writeFileSync(fn, JSON.stringify(doc, null, 2));
    }

    const bindingStream = q.queryBindings(opt.bind, { sources: opt.source })
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

    doc = await jp.frame(doc, opt.frame, { omitGraph: true, safe: true })
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

    if (cdl.auth.match(':')) {
      cdl.authBasic = Buffer.from(cdl.auth).toString('base64');
    } else {
      cdl.authBasic = cdl.auth;
    }
    // console.log('IN getCDLentries')
    // console.log(cdl.auth)
    // console.log(cdl.authBasic)

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
        // convert the xml atom feed to json
        const json = parser.toJson(xml, { object: true, arrayNotation: false });

        // add the entries to the results array
        if (json.feed.entry) {
          results = results.concat(json.feed.entry);
          //results.push(json.feed.entry);
        }

        // inspect the pagination to see if there are more pages
        const pagination = json.feed['api:pagination'];

        // Fetch the next page
        nextPage = null;
        for (let link of pagination["api:page"]) {
          if (link.position === 'next') {
            nextPage = link.href;
            // console.log('nextPage: ' + nextPage);

          }
          if (!nextPage) {
            lastPage = true;
            break;
          }
        }
      }
    }

    return results;
  }

}

export default ExpertsClient;
