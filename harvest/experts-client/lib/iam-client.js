/**
* @module iam-client
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
export class IamClient {

  const ENV={
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
    }
  };

  /**
  * @constructor
  * Accepts a opt object with options from a commander program.
  */
  constructor(opt) {
    this.logger = opt.logger || logger;
    this.timeout = opt.timeout || 30000;
    this.env = opt.env || 'prod';
    this.url = IamClient.ENV[this.env].url;
    this.authname = IamClient.ENV[this.env].authname;
    this.secretpath = IamClient.ENV[this.env].secretpath;
    this.auth = null;

  }
  context() {
    return JSON.parse(JSON.stringify(IamClient.context));
  }

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
  }

  async getProfiles(search) {
    await this.getAuth();
    let url = encodeURI(`${opt.iam.url}/people/profile/search?key=${opt.iam.auth}&${search}`);

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

export default IamClient;
