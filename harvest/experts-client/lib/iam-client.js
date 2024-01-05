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
      "@base":"http://iam.ucdavis.edu/",
      "@vocab":"http://iam.ucdavis.edu/schema#",
      "iamId":"@id",
      "orgOId":"@id",
      "bouOrgOId":{
        "@type":"@id"
      },
      "titleCode":{"@type":"@id",
                   "@id":"@id",
                   "@base":"http://experts.ucdavis.edu/position/"
                  }
    }
  };

  static ENV={
    dev: {
      url: 'https://iet-ws-stage.ucdavis.edu/api/iam/',
      authname: 'iet-ws-stage',
      secretpath: 'projects/326679616213/secrets/ucdid_auth',
      timeout: 30000
    },
    prod: {
      url: 'https://iet-ws.ucdavis.edu/api/iam/',
      authname: 'iet-ws',
      secretpath: 'projects/326679616213/secrets/ucdid_auth',
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
    console.log(secretResp);
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
    this.log.trace({mark:`profile(${expert})`,expert:expert},`profile(${expert})`);
    let key=await this.getKey();
    expert = expert.replace(/^mailto:/, '').replace(/@ucdavis.edu$/, '');

    let url = encodeURI(`${this.url}/people/profile/search?key=${key}&userId=${expert}`);

    const response = await fetch(url);

    if (response.status !== 200) {
      throw new Error(`Did not get an OK from the server. Code: ${response.status}`);
    }
    let res = await response.json();
    console.log(res);
    if (res == null) {
      throw new Error(`No profiles returned from IAM.`);
    }
    this.log.info({measure:`profile(${expert})`,expert:expert},`profile(${expert})`);
    return JSON.stringify({
      "@context":this.context(),
      "@graph":res.responseData.results || []
    });
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
