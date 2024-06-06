/**
* @module IAM
* @version 1.0.0
* @license MIT
* @description Aggie Experts Client API provide methods to import and access IAM data.
*
*/
'use strict';

import fetch from 'node-fetch';
import JsonLdProcessor from 'jsonld';
import { logger } from './logger.js';
import { GoogleSecret } from '@ucd-lib/experts-api';

const jp = new JsonLdProcessor();
const gs = new GoogleSecret();

/** Exports a class
* @class
* @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
*/
export class IAM {

  static context ={
    "@context": {
      "@version":1.1,
      "@base":"ark:/87287/d7c08j/user/",
      "@vocab":"ark:/87287/d7c08j/schema#",
      "iamId":{
        "@type":"@id",
        "@id":"@id",
        "@context": {
          "@base":"ark:/87287/d7c08j/user/"
        }
      },
      "bouOrgoid":{
        "@type":"@id",
        "@context": {
          "@base":"ark:/87287/d7c08j/organization/"
        }
      },
      "titleCode":{
        "@type":"@id",
        "@context": {
          "@base":"ark:/87287/d7c08j/position/"
        }
      }
    }
  };

  static ENV={
    dev: {
      url: 'https://iet-ws-stage.ucdavis.edu/api/iam/',
      authname: 'iet-ws-stage',
      secretpath: 'projects/325574696734/secrets/ucdid_auth',
      timeout: 30000
    },
    prod: {
      url: 'https://iet-ws.ucdavis.edu/api/iam/',
      authname: 'iet-ws',
      secretpath: 'projects/325574696734/secrets/ucdid_auth',
      timeout: 30000
    }
  };

  static DEF = {
    env: 'prod',
    log: logger,
    timeout: 30000
  };

  /**
  * @constructor
  * Accepts a opt object with options from a commander program.
  */
  constructor(opt) {
    opt = opt || {};
    for (let k in IAM.DEF) {
      this[k] = opt[k] || IAM.DEF[k];
    }
    this.url = IAM.ENV[this.env].url;
    this.authname = IAM.ENV[this.env].authname;
    this.secretpath = IAM.ENV[this.env].secretpath;
    this.key = null;
  }

  context() {
    return JSON.parse(JSON.stringify(IAM.context));
  }

  async getKey() {
    if (this.key) {
      return this.key;
    }
    let secretResp = await gs.getSecret(this.secretpath);
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
  async profile(expert) {
    let key=await this.getKey();
    let url=`${this.url}/people/profile/search?key=${key}`

    let id
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
    }
    else {  // if expert is not a string, throw an error
      if (typeof expert !== 'string') {
        throw new Error('Invalid expert');
      }
      id = expert;
      expert = expert.replace(/^mailto:/, '').replace(/@ucdavis.edu$/, '');
      url = encodeURI(`${url}&userId=${expert}`);
    }
    performance.mark(`profile(${id})`);
    const response = await fetch(url);

    if (response.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
    }
    let res = await response.json();
    if (res == null) {
      throw new Error(`No profiles returned from IAM.`);
    }
    this.log.info({service:'iam',measure:`profile(${id})`},`►profile(${id})◄`);
    performance.clearMarks(`profile(${id})`);
    return {
      ...this.context(),
      "@id":`http://iam.ucdavis.edu/`,
      "@graph":res.responseData.results || []
    };
  }

  async getProfiles(search) {
    await this.getKey();
    let url = encodeURI(`${this.url}/people/profile/search?key=${this.key}&${search}`);

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
}

export default IAM;
