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
// We currently match the fin logger, but don't use the config yet
//const { logger } = require('@ucd-lib/fin-service-utils');
import { logger } from './logger.js';


const jp = new JsonLdProcessor();

import readablePromiseQueue from './readablePromiseQueue.js';

/** Exports a class
* @class
* @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
*/
export class ExpertsClient {

  static context = {
    "@context": {
      "@base": "http://oapolicy.universityofcalifornia.edu/",
      "@vocab": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "oap": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "api": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "id": { "@type": "@id", "@id": "@id" },
      "field-name": "api:field-name",
      "field-number": "api:field-number",
      "$t": "api:field-value",
      "api:person": { "@container": "@list" },
      "api:first-names-X": { "@container": "@list" },
      "api:web-address": { "@container": "@list" }
    },
    "@id":'http://oapolicy.universityofcalifornia.edu/'
  };

  /**
  * @constructor
  * Accepts a opt object with options from a commander program.
  */
  constructor(opt) {
    this.opt = opt;
    this.logger = opt.logger || logger;
    this.experts = [];
    this.debugRelationshipDir = opt.debugRelationshipDir || 'relationships';
    // Store crosswalk of user=>CDL ID
    this.userId = {};

    this.cdl = opt.cdl || {};
    if (this.cdl?.auth.match(':')) {
      this.cdl.authBasic = Buffer.from(this.cdl.auth).toString('base64');
    } else {
      this.cdl.authBasic = this.cdl.auth;
    }
    // Author options
    this.author_truncate_to = opt.authorTruncateTo || 10000;
    this.author_trim_info = opt.authorTrimInfo || false
    // debugging
    this.debug_save_xml = opt.debugSaveXml || false

  }
  context() {
    return JSON.parse(JSON.stringify(ExpertsClient.context));
  }

  getUserId(user) {
    if (this.userId[user]) {
      return this.userId[user];
    }
    throw new Error(`User ${user} not found in crosswalk`);
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

    const bindingStream = q.queryBindings(opt.bind, { sources: [opt.db.source()] })

    const queue = new readablePromiseQueue(bindingStream, insertBoundConstruct,
      { name: 'insert', max_promises: 10, logger: this.logger });
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
      performance.mark(fn);
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
      fs.ensureFileSync(fn);
      fs.writeFileSync(fn, JSON.stringify(doc, null, 2));
      this.logger.info({measure:[fn],quads:quads.length},'record');
      performance.clearMarks(fn);
    }

    const bindingStream = q.queryBindings(opt.bind, { sources: [opt.db.source()], fetch })
    const queue = new readablePromiseQueue(bindingStream, constructRecord,
      { name: 'splay', max_promises: 5, logger: this.logger });
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
   * @description Fetch one XML page, save if debugging
   * @param {
   * } opt
   * @returns XML
   *
   */
  async getXMLPageAsObj(page, name = 'query', count = 0, timeout = 30000) {
    const dir = path.join('.', name);
    const fn = path.join(dir, 'page_' + count.toString().padStart(3, '0') + '.xml');
    let xml;

    if (this.debug_save_xml) {
      if (fs.existsSync(fn)) {
        this.logger.info(`DEBUG: Reading saved: ${fn}`);
        xml = fs.readFileSync(fn);
      }
    }
    // If not saved, or not found, then fetch
    if (!xml) {
      const requestTimeout = timeout; // Set the timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

      try {
        const response = await fetch(page, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Authorization': 'Basic ' + this.cdl.authBasic,
            'Content-Type': 'text/xml'
          }
        })

        clearTimeout(timeoutId); // Clear the timeout as the request was successful

        if (response.status !== 200) {
          this.logger.error(`Did not get an OK from the server. Code: ${response.status}`);
          return null;
        }
        xml = await response.text();

      } catch (error) {
        this.logger.error(`Error fetching ${page}: ${error}`);
        return null;
      }

      if (this.debug_save_xml) {
        try {
          this.logger.info(`DEBUG: writing ${fn}`);
          fs.mkdirSync(dir, { recursive: true }); // Create the directory and its parents if they don't exist
          fs.writeFileSync(fn, xml);
        } catch (error) {
          this.logger.error(`Error creating or writing the file: ${error}`);
        }
      }
      // convert the xml atom feed to json
      const json = parser.toJson(xml, { object: true, arrayNotation: false });
      return json;
    }
  }

  nextPage(pagination) {
    let pages = pagination["api:page"];
    Array.isArray(pages) || (pages = [pages]);
    for (let link of pages) {
      if (link.position === 'next') {
        return link.href;
      }
    }
    return null;
  }

  /**
 * @description Generic function to get all the entries from a CDL collection
 * @param {
  * } opt
  * @returns
  *
  */
  async getCDLentries(query, name = 'query') {
    var lastPage = false
    var results = [];
    var nextPage = path.join(this.cdl.url, query)
    var count = 0;

    while (nextPage) {
      const page = await this.getXMLPageAsObj(nextPage, name, count++, this.cdl.timeout);
      // add the entries to the results array
      if (page && page.feed && page.feed.entry) {
        results = results.concat(page.feed.entry);
      }
      if (page && page.feed && page.feed['api:pagination']) {
        nextPage = this.nextPage(page?.feed?.['api:pagination']);
      }
    }
    return results;
  }


  /**
   * @description Get user from CDL and post to a fuseki database
   * @param {
   * } opt
   * @returns
   *
   */
  async getPostUser(db, user, query = 'detail=full') {
    // Get a full profile for the user
    let page = `users?username=${user}@ucdavis.edu`
    if (query) {
      page += `&${query}`
    }

    const entries = await this.getCDLentries(page, user);

    this.userId[user] = entries[0]["api:object"].id;

    // Create the JSON-LD for the user profile
    let contextObj = this.context();
    contextObj["@graph"] = entries;

    const jsonld = JSON.stringify(contextObj);
    await db.createGraphFromJsonLdFile(jsonld);

    this.logger.info(`graph ${user} added`);
  }

  /**
 * @description Get relationships from CDL and post them to a fuseki database
 * @param {
  * } opt
  * @returns
  *
  */
  async getPostUserRelationships(db, user, query = 'detail=full', opt) {
    let lastPage = false
    const cdlId = this.getUserId(user);
    let nextPage = `${this.cdl.url}/users/${cdlId}/relationships`
    if (query) {
      nextPage += `?${query}`
    }

    // Trim extraneous info from authors
    function author_trim_info(author) {
      delete (author['api:addresses']);
    }

    // modify author information
    function update_author(me, work) {
      const max_authors = me.author_truncate_to;
      let records = work?.['api:object']?.['api:records']?.['api:record'] || [];
      Array.isArray(records) || (records = [records]);
      records.forEach((record) => {
        // logger.info(`record: ${record.id}`);
        let fields = record?.['api:native']?.['api:field'] || [];
        Array.isArray(fields) || (fields = [fields]);
        fields.forEach((field) => {
          if (field.name === 'authors') {
            let authors = field?.['api:people']?.['api:person'] || [];
            Array.isArray(authors) || (authors = [authors]);
            for (let i = 0; i < (authors.length < max_authors ? authors.length : max_authors); i++) {
              if (me.author_trim_info) { author_trim_info(authors[i]); }
            }
            if (authors.length>1) {
              if (me.author_trim_info) { author_trim_info(authors[authors.length-1]); }
            }
            authors.splice(max_authors, authors.length - max_authors - 1);
          }
        });
      });
      return work;
    }

    let count = 0;

    while (nextPage) {
      let results = [];
      let entries = [];

      performance.mark(`${user}_${count}`);
      performance.mark(`${user}_${count}_fetch`);

      const page=await this.getXMLPageAsObj(nextPage,path.join(user,this.debugRelationshipDir),count,this.cdl.timeout);
      performance.mark(`${user}_${count}_post`);
      this.logger.info({measure:[`${user}_${count}`,`${user}_${count}_fetch`],user:user,page:count},`fetched`);
      performance.clearMarks(`${user}_${count}_fetch`);
      // add the entries to the results array

      // Bad writing here
      if (this.debug_save_xml) {
        const dir = path.join(user, this.debugRelationshipDir);
        const fn = path.join(dir, 'page_' + count.toString().padStart(3, '0') + '.json');
        try {
          fs.mkdirSync(dir, { recursive: true }); // Create the directory and its parents if they don't exist
          this.logger.info(`DEBUG: writing ${fn}`);
          fs.writeFileSync(fn, JSON.stringify(page, null, 2));
        } catch (error) {
          this.logger.error(`Error creating or writing ${fn}: ${error}`);
        }
      }
      // add the entries to the results array
      if (page.feed.entry) {
        entries = entries.concat(page.feed.entry);
        for (let work of entries) {
          let related = [];
          if (work['api:relationship']?.['api:related']) {
            if (this.author_truncate_to || this.author_trim_info) {
              related.push(update_author(this,work['api:relationship']['api:related']))
            } else {
              related.push(work['api:relationship']['api:related'])
            }
          }
          related.push({ direction: 'to', id: cdlId, category: 'user' })
          work['api:relationship'] ||= {};
          work['api:relationship']['api:related'] = related;
          results.push(work['api:relationship']);
        }
        // Create the JSON-LD for the user relationships
        // save a text version of the context object
        let contextObj = this.context();
        contextObj["@graph"] = results;

        let jsonld = JSON.stringify(contextObj, null, 2);

        // Bad writing here
        if (this.debug_save_xml) {
          const dir = path.join(user, this.debugRelationshipDir);
          const fn = path.join(dir, 'jsonld_' + count.toString().padStart(3, '0') + '.json');
          try {
            this.logger.info(`DEBUG: writing ${fn}`);
            fs.mkdirSync(dir, { recursive: true }); // Create the directory and its parents if they don't exist
            fs.writeFileSync(fn, jsonld);
          } catch (error) {
            this.logger.error(`Error creating or writing ${fn}: ${error}`);
          }
        }

        // Insert into our local Fuseki DB
        await db.createGraphFromJsonLdFile(jsonld);
      }
      // Fetch the next page
      this.logger.info({measure:[`${user}_${count}`,`${user}_${count}_post`],user:user,page:count},`posted`);
      performance.clearMarks(`${user}_${count}_post`);
      performance.clearMarks(`${user}_${count}`);
      count++
      nextPage = this.nextPage(page?.feed?.['api:pagination']);
    }
    return;
  }
}

export default ExpertsClient;
