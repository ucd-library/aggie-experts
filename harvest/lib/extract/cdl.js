/**
* @module cdl-client
* @version 1.0.0
* @license MIT
* @description Aggie Experts Client API provide methods to cdl data.
*
*/


import fetch from 'node-fetch';
import path from 'path';

import { logger, GoogleSecret, config } from '@ucd-lib/experts-commons';
import cache from '../cache.js';
import xmlToJson from './xml-to-json.js';

/**
 * Elements can return different XML envelopes depending on schema version.
 *
 * - v5.5: Atom <feed> with feed.entry and feed['api:pagination']
 * - v6.13: <api:response> with api:result-list/api:result and api:pagination
 *
 * These helpers provide a uniform way to read entries/objects and pagination
 * without rewriting/mutating the original JSON structure.
 */
function getElementsPagination(json) {
  return json?.feed?.['api:pagination'] || json?.['api:response']?.['api:pagination'] || null;
}

function getElementsObjects(json) {
  // v5.5 Atom
  if (json?.feed?.entry !== undefined) {
    let entries = json.feed.entry || [];
    if (!Array.isArray(entries)) entries = [entries];
    return entries.map(e => e?.['api:object']).filter(Boolean);
  }

  // v6.13 api:response
  let results = json?.['api:response']?.['api:result-list']?.['api:result'] || [];
  if (!Array.isArray(results)) results = [results];
  return results.map(r => r?.['api:object']).filter(Boolean);
}

function getElementsRelationships(json) {
  // v5.5 Atom: relationship is the api:object
  if (json?.feed?.entry !== undefined) {
    return getElementsObjects(json);
  }

  // v6.13 api:response: relationships are nested under api:relationship
  let results = json?.['api:response']?.['api:result-list']?.['api:result'] || [];
  if (!Array.isArray(results)) results = [results];
  return results.map(r => r?.['api:relationship']).filter(Boolean);
}

function getElementsResultsCount(json) {
  const pagination = getElementsPagination(json);
  const rc = pagination?.['results-count'];
  const n = (typeof rc === 'string' || typeof rc === 'number') ? Number(rc) : null;
  return Number.isFinite(n) ? n : null;
}

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
    this.env = opt.env || config.cdl.env;

    if( !config.cdl[this.env] ) {
      throw new Error(`CDL environment ${this.env} not found in config.  Options are: ${Object.keys(config.cdl).join(', ')}`);
    }

    this.url = config.cdl[this.env].url;
    this.authname = config.cdl[this.env].authname;
    this.secretName = config.cdl[this.env].secretName;
    this.auth = null;

    this.experts = [];
    this.debugRelationshipDir = opt.debugRelationshipDir || 'relationships';
    // Store crosswalk of user=>CDL ID
    this.userId = {};

    // Author options
    this.author_truncate_to = opt.authorTruncateTo || 40;
    this.author_trim_info = opt.authorTrimInfo || true;
  }

  // Get the auth token from the secret manager
  async getAuth() {
    if (this.auth) {
      return this.auth;
    }

    if( !config.google.applicationCredentials ) {
      throw new Error('No service account file provided.');
    }

    let secretResp = await GoogleSecret.getSecret(this.secretName);
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
  // async graphify(doc, frame, graph) {
  //   frame['@context'] = (frame['@context'] instanceof Array ? frame['@context'] : [frame['@context']])
  //   frame['@context'].push({ "@base": graph.value });
  //   frame['@id'] = graph.value;

  //   doc = await jp.frame(doc, opt.frame, { omitGraph: true, safe: false })
  //   doc['@context'] = [
  //     "info:fedora/context/experts.json",
  //     { "@base": graph.value }];

  // }


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

    let jsonFile = path.join(config.cache.cdlDir, `${name}/${name}_${count.toString().padStart(3, '0')}.json`);

    await this.getAuth();

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    let resp;

    logger.info(`Fetching CDL ${name}:${count}`);

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

    let json = await xmlToJson(xml);

    // v6.13 responses do not include Atom's feed.updated; keep cache-stability logic
    // but apply it only if present.
    delete json?.feed?.updated;

    // filter authors data
    json = this.updateAuthors(json);

    // Allow callers to skip writing useless terminal pages (eg v6.13 results-count=0 with continue-from)
    if (typeof options.skipWriteIfEmpty === 'function') {
      const skip = await options.skipWriteIfEmpty(json);
      if (skip) {
        return {
          writeResp: null,
          jsonFile,
          json,
          skippedWrite: true
        };
      }
    }

    let writeResp = null;
    if( options.name === 'groups' ) {
      writeResp = await cache.write(
        path.join(cache.getPath(), options.cacheName), 
        json
      );
    } else {
      writeResp = await cache.writeUserAsset(options.cacheName, jsonFile, json);
    }

    return {
      writeResp,
      jsonFile,
      json
    };
  }

  /**
   * @method nextPage
   * @description Get the next page from the pagination object
   * @param {Object} pagination - The pagination object from the feed.
   * @returns {string|null} - Returns the URL of the next page or null if there is no next page.
   */
  nextPage(pagination, seen=new Set()) {
    if (!pagination || !pagination["api:page"]) {
      return null;
    }

    let pages = pagination["api:page"];
    Array.isArray(pages) || (pages = [pages]);

    // Prefer the cursor-based paging link Elements provides.
    // Some responses may include BOTH 'continue-from' and 'next'.
    // Make the priority deterministic: pick 'continue-from' if present, otherwise fall back to 'next'.
    let href = null;

    for (let link of pages) {
      if (link.position === 'continue-from') {
        href = link.href;
        break;
      }
    }

    if (!href) {
      for (let link of pages) {
        if (link.position === 'next') {
          href = link.href;
          break;
        }
      }
    }

    if (!href) return null;

    // Guard against loops (server returning same continue-from repeatedly)
    if (seen.has(href)) {
      logger.warn(`Pagination loop detected; stopping at ${href}`);
      return null;
    }
    seen.add(href);

    return href;
  }

  /**
   * @method updateAuthors
   * @description Update authors in json object, trim to max number of
   * authors and remove api:addresses depending on options in constructor
   * @param {Object} json
   */
  updateAuthors(json) {
    const objects = getElementsObjects(json);
    if (objects.length) {
      objects.forEach(obj => {
        let records = obj?.['api:relationship']?.['api:related']?.['api:object']?.['api:records']?.['api:record'] || [];
        Array.isArray(records) || (records = [records]);

        records.forEach((record) => {
          let fields = record?.['api:native']?.['api:field'] || [];
          Array.isArray(fields) || (fields = [fields]);
          fields.forEach((field) => {
            if( field.name === 'authors' ) {
              let authors = field?.['api:people']?.['api:person'] || [];
              Array.isArray(authors) || (authors = [authors]);
              for (let i = 0; i < (authors.length < this.author_truncate_to ? authors.length : this.author_truncate_to); i++) {
                if (this.author_trim_info) delete (authors[i]['api:addresses']);
              }
              if (authors.length > 1 && this.author_trim_info) delete (authors[authors.length-1]['api:addresses']);
              authors.splice(this.author_truncate_to, authors.length - this.author_truncate_to - 1);
            }
          });
        });
      });
    }

    return json;
  }

  /**
   * @method getGroupList
   * @description Get user from CDL and post to a fuseki database
   * @param {String} groups - Comma separated list of group IDs or names to get users from.
   *
   * @returns {Promise<void>}
   */
  async getGroupList(group, options={}) {
    const users = [];
    if (!group) {
      throw new Error('group is required');
    }

    if( !group.match(/^\d+$/) ) {
      if( config.cdl[this.env].group_by_name[group] ) {
        group = config.cdl[this.env].group_by_name[group];
      } else {
        throw new Error(`Group ${group} not found.  Please use a group ID or a group name from the list: ${Object.keys(config.cdl[this.env].group_by_name).join(',')}`);
      }
    }

    let nextPage = `${this.url}/users?detail=ref&per-page=1000&groups=${group}`;

    let count = 0;
    const seenPages = new Set();
    while (nextPage) {
      const { json } = await this.fetch(nextPage, {
        cacheName: 'group-' + group,
        name:'groups',
        count,
        force: options.force || false
      });

      const objects = getElementsObjects(json);
      for (const obj of objects) {
        users.push(obj['username']);
      }

      count++;
      nextPage = this.nextPage(getElementsPagination(json), seenPages);
    }

    let groupName = '';
    for( const [name, id] of Object.entries(config.cdl[this.env].group_by_name) ) {
      if( id == group ) {
        groupName = name;
        break;
      }
    }

    let cachePath = await cache.write(
      path.join(cache.getPath(), `users-list-${groupName}.json`), 
      {groupId: group, groupName, users}
    );

    return {
      groupId: group,
      groupName,
      users,
      cachePath
    };
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
    let writeResps = [];
    const seenPages = new Set();

    while (nextPage) {
      const { json, writeResp, skippedWrite } = await this.fetch(nextPage, {
        name: 'user',
        cacheName : user,
        count,
        force: options.force,
        // prevent creation of trailing useless user_00N.json pages
        skipWriteIfEmpty: (j) => {
          const rc = getElementsResultsCount(j);
          if (rc === 0) return true;
          const objs = getElementsObjects(j);
          return Array.isArray(objs) && objs.length === 0;
        }
      });

      const objects = getElementsObjects(json);
      if (objects.length === 0 && count === 0) {
        throw new Error(`User ${user} not found in CDL elements`);
      }

      if (writeResp && !skippedWrite) {
        writeResps.push(writeResp);
      }

      // Save CDL ID to this
      if (!this.userId[user] && objects[0]?.id) {
        this.userId[user] = objects[0].id;
      }

      count++;
      nextPage = this.nextPage(getElementsPagination(json), seenPages);

      // Extra safety: if server says there are 0 results, stop paging.
      const resultsCount = getElementsResultsCount(json);
      if (resultsCount === 0) {
        break;
      }
    }

    return writeResps;
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
    let count = 0;
    let writeResps = [];
    const seenPages = new Set();

    while (nextPage) {

      const { json, writeResp, skippedWrite } = await this.fetch(nextPage, {
        name: 'rel',
        cacheName : user,
        force: options.force,
        count,
        // prevent creation of trailing useless rel_00N.json pages
        skipWriteIfEmpty: (j) => getElementsResultsCount(j) === 0
      });

      if (writeResp && !skippedWrite) {
        writeResps.push(writeResp);
      }

      count++;
      nextPage = this.nextPage(getElementsPagination(json), seenPages);

      // IMPORTANT: v6.13 relationship results are under api:relationship, not api:object.
      // Do not use getElementsObjects(json).length to decide pagination.
      const resultsCount = getElementsResultsCount(json);
      if (resultsCount === 0) {
        break;
      }

      // Additional safety: if no relationships are actually present, stop.
      const rels = getElementsRelationships(json);
      if (rels.length === 0) {
        break;
      }
    }


    return writeResps;
  }
}

export default CdlClient;
