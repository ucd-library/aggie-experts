/**
* @module cdl-client
* @version 1.0.0
* @license MIT
* @description Aggie Experts Client API provide methods to cdl data.
*
*/
'use strict';

import fs from 'fs-extra';
import fetch from 'node-fetch';
import JsonLdProcessor from 'jsonld';
import path from 'path';
import parser from 'xml2json';
import { logger } from './logger.js';

const jp = new JsonLdProcessor();

/** Exports a class
* @class
* @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
*/
export class CdlClient {

  static ENV={
    qa:{
      url : 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
      authname : 'qa-oapolicy',
      secretpath : 'projects/326679616213/secrets/cdl_elements_json',
      timeout : 30000
    },
    prod: {
      url : 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
      authname : 'oapolicy',
      secretpath : 'projects/326679616213/secrets/cdl_elements_json',
      timeout : 30000
    }
  };

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

    this.timeout = opt.timeout || 30000;
    this.logger = opt.logger || logger;
    this.env = opt.env || 'prod';
    this.url = CdlClient.ENV[this.env].url;
    this.authname = CdlClient.ENV[this.env].authname;
    this.secretpath = CdlClient.ENV[this.env].secretpath;
    this.auth = null;

    this.experts = [];
    this.debugRelationshipDir = opt.debugRelationshipDir || 'relationships';
    // Store crosswalk of user=>CDL ID
    this.userId = {};

    // Author options
    this.author_truncate_to = opt.authorTruncateTo || 10000;
    this.author_trim_info = opt.authorTrimInfo || false
    // debugging
    this.debug_save_xml = opt.debugSaveXml || false
    this.save_dir = 'saved_xml'
  }

  // Get the auth token from the secret manager
  async getAuth() {
    if (this.auth) {
      return this.auth;
    }
    let secretResp = await gs.getSecret(this.secretpath);
    let secretJson = JSON.parse(secretResp);
    for (const entry of secretJson) {
      if (entry['@id'] == this.authname) {
        this.auth = entry.auth.raw_auth;
      }
    }
    // convert to auth basic
    if (this.auth.match(':')) {
      this.authBasic = Buffer.from(this.auth).toString('base64');
    } else {
      this.authBasic = this.auth;
    }
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
  async getXMLPageAsObj(page, name = 'query', count = 0) {
    const dir = path.join(this.save_dir, name);
    const fn = path.join(dir, 'page_' + count.toString().padStart(3, '0') + '.xml');
    let xml;

    if (this.debug_save_xml) {
      if (fs.existsSync(fn)) {
        this.logger.info({fn,action:"read"},`DEBUG: Reading saved: ${fn}`);
        xml = fs.readFileSync(fn);
      }
    }
    // If not saved, or not found, then fetch
    if (!xml) {
      this.getAuth();
      const requestTimeout = this.timeout; // Set the timeout
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
          this.logger.info({action:"save",fn},`DEBUG: writing ${fn}`);
          fs.ensureFileSync(fn);
          fs.writeFileSync(fn, xml);
        } catch (error) {
          this.logger.error(`Error creating or writing the file: ${error}`);
        }
      }
    }
    // convert the xml atom feed to json
    this.logger.info(`Converting ${fn} to json`);
    const json = await parser.toJson(xml, { object: true, arrayNotation: false });
    return json;
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
  async getCDLentries(query,name='getCDLentries') {
    let lastPage = false
    let results = [];
    let nextPage = `${this.cdl.url}/${query}`

    let count = 0;

    performance.mark(name);
    while (nextPage) {
      performance.mark(`${name}_${count}`);
      const page = await this.getXMLPageAsObj(nextPage,name, count);
      this.logger.info(
        {measure:[`${name}_${count}`],
         page:count},`fetched`)
      if (this.debug_save_xml) {
        const dir = path.join(this.save_dir,name);
        const fn = path.join(dir, 'page_' + count.toString().padStart(3, '0') + '.json');
        try {
          fs.ensureFileSync(fn);
          fs.writeFileSync(fn, JSON.stringify(page, null, 2));
         this.logger.info({fn,action:"save",count},`DEBUG: write ${fn}`);
        } catch (error) {
          this.logger.error(`Error creating or writing ${fn}: ${error}`);
        }
      }
      // add the entries to the results array
      if (page?.feed?.entry) {
        results = results.concat(page.feed.entry);
      }
      performance.clearMarks(`${name}_${count}`);
      count++;
      nextPage = this.nextPage(page?.feed?.['api:pagination']);
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
    let lastPage = false
    // Get a full profile for the user
    let nextPage = `${this.cdl.url}/users?username=${user}@ucdavis.edu`
    if (query) {
      nextPage += `&${query}`
    }

    let count = 0;

    while (nextPage) {
      let results=[];
      performance.mark(`${user}_${count}`);
      const page = await this.getXMLPageAsObj(nextPage,user, count);
      this.logger.info(
        {measure:[`${user}_${count}`],
         post:"expert",
         user:user,
         page:count},`fetched`)
      if (this.debug_save_xml) {
        const dir = path.join(this.save_dir,user);
        const fn = path.join(dir, 'page_' + count.toString().padStart(3, '0') + '.json');
        try {
          fs.ensureFileSync(fn);
          fs.writeFileSync(fn, JSON.stringify(page, null, 2));
          this.logger.info({fn,action:"save",count},`DEBUG: write ${fn}`);
        } catch (error) {
          this.logger.error(`Error creating or writing ${fn}: ${error}`);
        }
      }

      // add the entries to the results array
      if (page?.feed?.entry) {
        results = results.concat(page.feed.entry);
        // Save CDL ID to this
        this.userId[user]=results[0]["api:object"].id;

        let contextObj = this.context();
        contextObj["@graph"] = results;
        let jsonld = JSON.stringify(contextObj);

        if (this.debug_save_xml) {
          const dir = path.join(this.save_dir,user);
          const fn = path.join(dir, 'jsonld_' + count.toString().padStart(3, '0') + '.json');
          try {
            fs.ensureFileSync(fn);
            fs.writeFileSync(fn, jsonld);
            this.logger.info({fn,action:"save",count},`DEBUG: write ${fn}`);
          } catch (error) {
            this.logger.error(`Error creating or writing ${fn}: ${error}`);
          }
        }
        // Insert into our local Fuseki DB
        await db.createGraphFromJsonLdFile(jsonld);
      }
      // Fetch the next page
      this.logger.info(
        {
          measure:[`${user}_${count}`,`${user}_${count}_post`],
          user:user,
          post:"expert",
          page:count},`posted`);
      performance.clearMarks(`${user}_${count}_post`);
      performance.clearMarks(`${user}_${count}`);
      count++
      nextPage = this.nextPage(page?.feed?.['api:pagination']);
    }
    return count;
  }

  /**
 * @description Get relationships from CDL and post them to a fuseki database
 * @param {
  * } opt
  * @returns
  *
  */
  async getPostUserRelationships(db, user, query = 'detail=full') {
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

      performance.mark(`${user}_rel_${count}`);

      const page=await this.getXMLPageAsObj(nextPage,path.join(user,this.debugRelationshipDir),count);
      performance.mark(`${user}_rel_${count}_post`);
      this.logger.info(
        {
          measure:[`${user}_rel_${count}`],
          post:"relationship",
          user:user,
          page:count},`fetched`);

      // Bad writing here
      if (this.debug_save_xml) {
        const dir = path.join(this.save_dir,user, this.debugRelationshipDir);
        const fn = path.join(dir, 'page_' + count.toString().padStart(3, '0') + '.json');
        try {
          fs.ensureFileSync(fn);
          fs.writeFileSync(fn, JSON.stringify(page, null, 2));
          this.logger.info({fn,action:"save",count},`DEBUG: write ${fn}`);
        } catch (error) {
          this.logger.error(`Error creating or writing ${fn}: ${error}`);
        }
      }
      // add the entries to the results array
      if (page?.feed?.entry) {
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
          const dir = path.join(this.save_dir,user, this.debugRelationshipDir);
          const fn = path.join(dir, 'jsonld_' + count.toString().padStart(3, '0') + '.json');
          try {
            fs.ensureFileSync(fn);
            fs.writeFileSync(fn, jsonld);
            this.logger.info({fn,action:"save",count},`DEBUG: write ${fn}`);
          } catch (error) {
            this.logger.error(`Error creating or writing ${fn}: ${error}`);
          }
        }

        // Insert into our local Fuseki DB
        await db.createGraphFromJsonLdFile(jsonld);
      }
      // Fetch the next page
      this.logger.info(
        {
          measure:[`${user}_rel_${count}`,`${user}_rel_${count}_post`],
          user:user,
          post:"relationship",
          page:count},`posted`);
      performance.clearMarks(`${user}_rel_${count}_post`);
      performance.clearMarks(`${user}_rel_${count}`);
      count++
      nextPage = this.nextPage(page?.feed?.['api:pagination']);
    }
    return count;
  }
}

export default CdlClient;
