/**
* @module IAM
* @version 1.0.0
* @license MIT
* @description Aggie Experts Client API provide methods to import and access IAM data.
*
*/
'use strict';

import fetch from 'node-fetch';
import logger from '../logger.js';
import GoogleSecret from '../../../commons/google-secret.js';
import config from '../config.js';
import cache from '../cache.js';
import path from 'path';


/** Exports a class
* @class
* @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
*/
export class IAM {


  /**
  * @constructor
  * Accepts a opt object with options from a commander program.
  */
  constructor(opt) {
    opt = opt || {};
    this.log = opt.log || logger;
    this.timeout = opt.timeout || config.iam.timeout;
    let env = opt.env || config.iam.env;
    this.url = config.iam[env].url;
    this.authname = config.iam[env].authname;
    this.secretName = config.iam[env].secretName;
    this.key = null;
  }

  context() {
    return JSON.parse(JSON.stringify(config.iam.context));
  }

  async getKey() {
    if (this.key) {
      return this.key;
    }
    let secretResp = await GoogleSecret.getSecret(this.secretName);
    let secretJson = JSON.parse(secretResp);
    for (const entry of secretJson) {
      if (entry['@id'] == this.authname) {
        this.key = entry.auth.raw_auth.split(':')[1];
      }
    }
    return this.key;
  }

  /**
   * @function profile
   * @description Get a person by their eduroam url.
   * @param {string} expert - The eduroam of the person to get.
   * @returns {json} - The JSON profile, with @context added.
   * @throws {Error} - Throws an error if the person is not found.
   **/
  async profile(expert, opts={}) {
    let key = await this.getKey();
    let url = `${this.url}/people/profile/search?key=${key}`;

    let id;
    if (typeof expert === 'object') {
      if (expert.email) {
        id = expert.email;
        url = encodeURI(`${url}&email=${expert.email}`);
      } else if (expert.userId) {
        id = expert.userId;
        url = encodeURI(`${url}&userId=${expert.userId}`);
      } else {
        throw new Error('Invalid expert object');
      }
    } else {  // if expert is not a string, throw an error
      if (typeof expert !== 'string') {
        throw new Error('Invalid expert');
      }
      id = expert;
      expert = expert.replace(/^mailto:/, '').replace(new RegExp(config.userDomain+'$'), '');
      url = encodeURI(`${url}&userId=${expert}`);
    }

    const jsonldfn = path.join(config.cache.iamDir, config.cache.iamUserFilename);

    // Mask the key in the URL for logging
    const maskedUrl = url.replace(/([?&]key=)[^&]+/, '$1********');
    this.log.info(`Fetching iam profile ${id} from: ${maskedUrl}`);
    await this.getKey();


    const response = await fetch(url);

    if (response.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
    }

    let res = await response.json();
    if (res == null) {
      throw new Error(`✘ profile(${id}) - not found`);
    }

    if( !res.responseData || !res.responseData.results || res.responseData.results.length === 0 ) {
      logger.warn(`No IAM profile found for expert: ${id}`, JSON.stringify(res || {}));
      return {
        notFound : true
      }
    }

    let writeResp;
    if( opts.cacheKey ) {
      writeResp = await cache.writeUserAsset(opts.cacheKey, jsonldfn, res);
    }

    return {
      writeResp,
      jsonldfn,
      json: res
    };
  }

  async getProfiles(search) {
    await this.getKey();
    let url = encodeURI(`${this.url}/people/profile/search?key=${this.key}&${search}`);

    const response = await fetch(url);

    if (response.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
    } else if (response.status === 200) {
      let respJson = await response.json();
      // console.log(this.doc);
      if (respJson == null) {
        throw new Error(`No profiles returned from IAM.`);
      }
      this.experts = this.experts.concat(respJson.responseData.results);
    }
    return
  }
}

export default IAM;
