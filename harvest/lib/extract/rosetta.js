/**
* @module Rosetta
* @version 1.0.0
* @license MIT
* @description Aggie Experts Client API provides methods to fetch person data from the
* new IAM "rosetta" API (iam-rosetta-api), which is replacing the legacy IAM API.
*
*/
'use strict';

import fetch from 'node-fetch';
import { logger, GoogleSecret, config } from '@ucd-lib/experts-commons';
import cache from '../cache.js';
import path from 'path';

/** Exports a class
* @class
* @classdesc Aggie Experts Client API provides methods to fetch person data from the
* IAM rosetta API using OAuth2 client_credentials authentication.
*/
export class Rosetta {

  /**
  * @constructor
  * Accepts a opt object with options from a commander program.
  */
  constructor(opt) {
    opt = opt || {};
    this.log = opt.log || logger;
    this.timeout = opt.timeout || config.rosetta.timeout;
    let env = opt.env || config.rosetta.env;
    this.url = config.rosetta[env].url;
    this.secretName = config.rosetta[env].secretName;
    this.oauth = config.rosetta[env].oauth;
    this.endpoints = config.rosetta[env].endpoints;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * @function getToken
   * @description Fetch and cache an OAuth2 bearer token using the client_credentials grant,
   * refreshing it once it has expired.
   * @returns {Promise<string>} - The bearer access token.
   * @throws {Error} - Throws an error if the token endpoint does not return an OK response.
   **/
  async getToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    let secretResp = await GoogleSecret.getSecret(this.secretName);
    let { clientId, clientSecret } = JSON.parse(secretResp);

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    this.log.info(`Fetching rosetta OAuth token from: ${this.oauth.tokenUrl}`);

    const response = await fetch(this.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: this.oauth.scope
      })
    });

    if (response.status !== 200) {
      let body;
      try {
        body = await response.text();
      } catch (e) {
        body = '<no response body>';
      }
      throw new Error(`Did not get an OK from the rosetta token endpoint. Code: ${response.status}. Body: ${body}`);
    }

    let res = await response.json();
    if (!res || !res.access_token) {
      throw new Error('✘ getToken() - no access_token returned');
    }

    this.token = res.access_token;
    // subtract a small safety buffer so we refresh slightly before actual expiry
    this.tokenExpiresAt = Date.now() + (res.expires_in * 1000) - 5000;

    return this.token;
  }

  /**
   * @function buildUrl
   * @description Build a URL for the given endpoint, appending filters as query parameters.
   * @param {string} endpoint - The logical endpoint name (a key of config.rosetta[env].endpoints).
   * @param {Object} [filters={}] - Filter key/value pairs. Array values are appended as repeated params.
   * @returns {string} - The fully-qualified, encoded URL.
   **/
  buildUrl(endpoint, filters = {}) {
    let path = this.endpoints[endpoint];
    if (!path) {
      throw new Error(`Invalid rosetta endpoint: ${endpoint}`);
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.append(key, value);
      }
    }

    const qs = params.toString();
    return qs ? `${this.url}${path}?${qs}` : `${this.url}${path}`;
  }

  /**
   * @function people
   * @description Fetch person records via GET, using arbitrary query-parameter filters.
   * Transforms/result-shape interpretation are deferred to a later change - this returns
   * the raw parsed JSON response.
   * @param {Object} [filters={}] - Query filters (e.g. email, iamid, loginid, etc. per the API spec).
   * @param {Object} [opts={}] - Options.
   * @param {string} [opts.endpoint='people'] - Which configured endpoint to query
   * (people, peopleStudents, peopleEmployees, peopleFaculty, peopleExternal).
   * @returns {Promise<Object>} - The raw parsed JSON response body.
   * @throws {Error} - Throws an error if the response is not OK.
   **/
  async people(filters = {}, opts = {}) {
    const token = await this.getToken();
    const url = this.buildUrl(opts.endpoint || 'people', filters);

    this.log.info(`Fetching rosetta people from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status !== 200) {
      let body;
      try {
        body = await response.text();
      } catch (e) {
        body = '<no response body>';
      }
      throw new Error(`Did not get an OK from the server. Code: ${response.status}. Body: ${body}`);
    }

    return await response.json();
  }

  /**
   * @function profile
   * @description Fetch a single person's rosetta profile by login id or email, and cache the
   * raw response (parallel to IAM.profile()'s caching of the legacy iam/profile.json).
   * @param {string|Object} expert - A login id / email string, or an object with a `userId` or `email` key.
   * @param {Object} [opts={}] - Options.
   * @param {string} [opts.cacheKey] - When provided, the raw response is cached under this user's asset path.
   * @returns {Promise<Object>} - `{notFound: true}` if no record was found, otherwise `{writeResp, jsonfn, json}`.
   * @throws {Error} - Throws an error if the request is invalid or the response is not OK.
   **/
  async profile(expert, opts = {}) {
    let id, filters;
    if (typeof expert === 'object') {
      if (expert.email) {
        id = expert.email;
        filters = { email: expert.email };
      } else if (expert.userId) {
        id = expert.userId;
        filters = { loginid: expert.userId };
      } else {
        throw new Error('Invalid expert object');
      }
    } else {
      if (typeof expert !== 'string') {
        throw new Error('Invalid expert');
      }
      id = expert;
      const userId = expert.replace(/^mailto:/, '').replace(new RegExp(config.userDomain + '$'), '');
      filters = { loginid: userId };
    }

    this.log.info(`Fetching rosetta profile ${id}`);
    const res = await this.people(filters);

    if (!Array.isArray(res) || res.length === 0) {
      logger.warn(`No rosetta profile found for expert: ${id}`);
      return { notFound: true };
    }

    const jsonfn = path.join(config.cache.iamDir, config.cache.iamRosettaProfileFilename);

    let writeResp;
    if (opts.cacheKey) {
      writeResp = await cache.writeUserAsset(opts.cacheKey, jsonfn, res);
    }

    return { writeResp, jsonfn, json: res };
  }

  /**
   * @function peopleSearch
   * @description Fetch person records via POST, sending identity filter arrays
   * (e.g. { emails: [...], iamids: [...] }) in the JSON request body.
   * @param {Object} [body={}] - The identity filter arrays to search by.
   * @param {Object} [opts={}] - Options.
   * @param {string} [opts.endpoint='people'] - Which configured endpoint to query
   * (people, peopleStudents, peopleEmployees, peopleFaculty, peopleExternal).
   * @returns {Promise<Object>} - The raw parsed JSON response body.
   * @throws {Error} - Throws an error if the response is not OK.
   **/
  async peopleSearch(body = {}, opts = {}) {
    const token = await this.getToken();
    const path = this.endpoints[opts.endpoint || 'people'];
    if (!path) {
      throw new Error(`Invalid rosetta endpoint: ${opts.endpoint}`);
    }
    const url = `${this.url}${path}`;

    this.log.info(`Searching rosetta people at: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (response.status !== 200) {
      let body;
      try {
        body = await response.text();
      } catch (e) {
        body = '<no response body>';
      }
      throw new Error(`Did not get an OK from the server. Code: ${response.status}. Body: ${body}`);
    }

    return await response.json();
  }
}

export default Rosetta;
