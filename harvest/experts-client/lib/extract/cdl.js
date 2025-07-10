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
import { logger } from '../logger.js';
import GoogleSecret from '../google-secret.js';
import config from '../config.js'
const jp = new JsonLdProcessor();
const gs = new GoogleSecret();


/** Exports a class
* @class
* @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
*/
export class CdlClient {

  /**
  * @constructor
  * Accepts a opt object with options from a commander program.
  */
  constructor(opt={}) {

    this.timeout = opt.timeout || config.cdl.timeout;
    this.log = opt.log || logger;
    this.env = opt.env || config.cdl.env;

    if( !config.cdl[this.env] ) {
      throw new Error(`CDL environment ${this.env} not found in config.  Options are: ${Object.keys(config.cdl).join(', ')}`);
    }

    this.url = config.cdl[this.env].url;
    this.authname = config.cdl[this.env].authname;
    this.secretpath = config.cdl[this.env].secretpath;
    this.auth = null;

    this.experts = [];
    this.debugRelationshipDir = opt.debugRelationshipDir || 'relationships';
    // Store crosswalk of user=>CDL ID
    this.userId = {};

    // Author options
    this.author_truncate_to = opt.authorTruncateTo || 40;
    this.author_trim_info = opt.authorTrimInfo || true

  }

  // Get the auth token from the secret manager
  async getAuth() {
    if (this.auth) {
      return this.auth;
    }

    if( !process.env.GOOGLE_APPLICATION_CREDENTIALS ) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.  Please set it to the path of your Google Cloud service account key file.');
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
    return JSON.parse(JSON.stringify(config.cdl.context));
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
   * @method fetch
   * @description Fetch one XML page, save it to disk, and convert it to JSON.
   * @param {string} url - The URL to fetch the XML from.
   * @param {Object} options - Options for the request.
   * @param {string} [options.name='page'] - The name to use for the cache file.
   * @param {number} [options.count=0] - The count to use for the cache file.
   *
   * @throws {Error} If the fetch fails or the response status is not 200.
   * @returns {Promise<Object>} - Returns a promise that resolves to the JSON representation of the XML feed.
   */
  async fetch(url, options={}) {
    const name = options.name || 'page';
    const count = options.count || 0;
    const force = options.force || false;

    const dir = path.join(config.cache.rootDir, config.cache.cdlDir);
    const xmlfn = path.join(dir, `${name}_${count.toString().padStart(3, '0')}.xml`);
    const jsonldfn = path.join(dir, `${name}_${count.toString().padStart(3, '0')}.jsonld`);

    if( options.noCache !== true ) {
      if( !force && fs.existsSync(xmlfn) && fs.existsSync(jsonldfn) ) {
        this.log.info(`Skipping ${name}:${count} as it is already cached at ${xmlfn}`);
            
        const xml = fs.readFileSync(xmlfn, 'utf8');
        const json = await parser.toJson(xml, { object: true, arrayNotation: false });

        return {
          xmlfn,
          jsonldfn,
          json
        };
      }
    }

    await this.getAuth();

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    let resp;

    if( options.noCache !== true ) {
      this.log.info(`Fetching CDL ${name}:${count} to ${xmlfn}`);
    } else {
      this.log.info(`Fetching CDL ${name}:${count}`);
    }

    try {
      resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + this.authBasic,
          'Accept': 'text/xml'
        },
        signal: controller.signal
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        const error=new Error('Request timed out');
        error.status=504;
        throw error;
      }
      throw e;
    } finally {
      clearTimeout(id);
    }

    if (resp.status !== 200) {
      let error = new Error(`Error fetching ${url} status ${resp.status}`);
      error.status = resp.status;
      throw error;
    }
    let xml = await resp.text();

    if( options.noCache !== true ) {
      fs.ensureFileSync(xmlfn);
      fs.writeFileSync(xmlfn, xml);
    }

    // convert the xml atom feed to json
    this.log.info(`Converting ${xmlfn} to json`);
    const json = await parser.toJson(xml, { object: true, arrayNotation: false });

    if( json?.feed?.entry && options.noCache !== true ) {
      let contextObj = this.context();
      contextObj["@graph"] = options.transform ? options.transform(json.feed.entry) : json.feed.entry;

      fs.ensureFileSync(jsonldfn);
      fs.writeFileSync(jsonldfn, JSON.stringify(contextObj, null, 2));
    }

    return {
      xmlfn,
      jsonldfn,
      json: json
    };
  }

  /**
   * @method nextPage
   * @description Get the next page from the pagination object
   * @param {Object} pagination - The pagination object from the feed.
   * @returns {string|null} - Returns the URL of the next page or null if there is no next page.
   */
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
   * @method getGroupList
   * @description Get user from CDL and post to a fuseki database
   * @param {String} groups - Comma separated list of group IDs or names to get users from.
   * 
   * @returns {Promise<void>}
   */
  async getGroupList(groups) {
    const users = [];
    if (!groups) {
      throw new Error('groups is required');
    }

    groups = groups.split(',').map((group) => {
      if (group.match(/^\d+$/)) {
        return group;
      }
      if (config.cdl[this.env].group_by_name[group]) {
        return config.cdl[this.env].group_by_name[group];
      } else {
        throw new Error(`Group ${group} not found.  Please use a group ID or a group name from the list: ${Object.keys(config.cdl[this.env].group_by_name).join(',')}`);
      }
    }).join(',');

    let nextPage = `${this.url}/users?detail=ref&per-page=1000&groups=${groups}`;

    let count = 0;
    while (nextPage) {
      let entries = [];
      const page = await this.fetch(nextPage,{
        name:'groups',
        count,
        noCache: true
      });

      if (page?.feed?.entry) {
        entries = entries.concat(page.feed.entry);
        for (let entry of entries) {
          entry = entry['api:object'];
          users.push(entry['username']);
        }
      }

      count++;
      nextPage = this.nextPage(page?.feed?.['api:pagination']);
    }
    return users;
  }


  /**
   * @method getUser
   * @description Get user from CDL
   * @param {string} user - The user to get from CDL, can be a mailto: or just the username
   * @param {Object} options - Options for the request
   * @param {boolean} [options.force=false] - If true, will refetch the user even if it exists in the file cache
   * 
   * @returns {Promise<void>} - Returns a promise that resolves when the user is fetched and saved
   *
   */
  async getUser(user, options={}) {
    // Get a full profile for the user
    // remove leading mailto: from user
    let user_id = user.replace(/^mailto:/, '');
    let nextPage = `${this.url}/users?username=${user_id}&detail=full`

    let count = 0;

    while (nextPage) {

      const { json } = await this.fetch(nextPage, {
        name:'user', 
        count, 
        force: options.force
      });

      // add the entries to the results array
      if (json?.feed?.entry && json.feed.entry ) {
        if( !Array.isArray(json.feed.entry) ) {
          json.feed.entry = [json.feed.entry];
        }

        // Save CDL ID to this
        if( !this.userId[user] ) {
          this.userId[user] = json.feed.entry[0]['api:object'].id;
        }
      } else {
        this.log.warn(`No entries found for ${user}`);
      }

      count++
      nextPage = this.nextPage(json?.feed?.['api:pagination']);
    }
    return count;
  }

  /**
   * @method getUserRelationships
   * @description Get relationships from CDL
   * 
   * @param {string} user - The user to get relationships for, can be a mailto: or just the username
   * @param {Object} options - Options for the request
   * @param {boolean} [options.force=false] - If true, will refetch the relationships even if they exist in the file cache
   *
   * @returns {Promise<void>} - Returns a promise that resolves when the relationships are fetched and saved
   *
  */
  async getUserRelationships(user, options={}) {
    const cdlId = this.getUserId(user);

    if (!cdlId) {
      await this.getUser(user, options);
    }

    let nextPage = `${this.url}/users/${cdlId}/relationships?detail=full`


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
        // log.info(`record: ${record.id}`);
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

    function transform(json) {
      let results = [];
      for (let work of json.feed.entry) {
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
      return results;
    }

    let count = 0;

    while (nextPage) {

      const page = await this.fetch(nextPage, {
        name: 'rel',
        force: options.force,
        count,
        transform: transform.bind(this)
      });

      count++
      nextPage = this.nextPage(page?.feed?.['api:pagination']);
    }
    return count;
  }
}

export default CdlClient;
