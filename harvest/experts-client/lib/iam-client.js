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

const jp = new JsonLdProcessor();

/** Exports a class
* @class
* @classdesc Aggie Experts Client API provide methods to import and access Aggie Experts data.
*/
export class IamClient {

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
    this.opt = opt;
    this.logger = opt.logger || logger;

    this.iam=opt.iam || {};
    if (this.iam?.auth.match(':')) {
      this.iam.auth = this.iam.auth.split(':')[1];
    }

  }
  context() {
    return JSON.parse(JSON.stringify(IamClient.context));
  }

  async getProfiles(search) {
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
