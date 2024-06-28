import GoogleSecrets from './googleSecret.js';
import FormData from 'form-data';
import { JSDOM } from 'jsdom';
import fetchCookie from 'fetch-cookie';
import nodeFetch from 'node-fetch';
import AbortController from 'abort-controller';

export default class ElementsClient {
  static config = {
      cdl: {
        qa: {
          "@id": "qa-oapolicy",
          host: 'https://qa-oapolicy.universityofcalifornia.edu',
          api : 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
          authname : 'qa-oapolicy',
          secretpath : 'projects/325574696734/secrets/cdl-elements-json'
        },
        prod: {
          "@id": "oapolicy",
          host: 'https://oapolicy.universityofcalifornia.edu',
          api: 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
          authname : 'oapolicy',
          secretpath : 'projects/325574696734/secrets/cdl-elements-json'
        }
      }
  };

  static impersonators =
    {
      qa:{},
      prod:{}
    };

  static info(instance) {
    return ElementsClient.config.cdl[instance];
  }

  static async impersonate(userId,args) {
    const instance = args.instance || 'prod';
    if (ElementsClient.impersonators[instance]) {
      if ( ElementsClient.impersonators[instance][userId] ) {
        if ( ElementsClient.impersonators[instance][userId].expires > Date.now() )  {
          return ElementsClient.impersonators[instance][userId];
        } else {
          delete ElementsClient.impersonators[instance][userId];
        }
      }
      try {
        let user=new Impersonator(userId,args);
        await user.login();
        await user.impersonate();
        ElementsClient.impersonators[instance][userId]=user;
        return user
      } catch (e) {
        if (e.status !== 504) {
          e.message = `Impersonation failed: ${e.message}`;
          e.status=502;
        }
        throw e;
      }
    } else {
      throw new Error(`Bad instance ${instance}`);
    }
  }
}

export class Impersonator {

  constructor(userId,args={}) {

    this.instance = args.instance || 'prod';
    this.cdl = ElementsClient.info(this.instance);
    this.cookie_jar=new fetchCookie.toughCookie.CookieJar();
    this.fetch = fetchCookie(nodeFetch, this.cookie_jar);
    this.userId=userId;
    // create expiration date 1 hour from now
    this.expires=Date.now() + 1000 * 60 * 60; // 1 hour
  }

  async fetchWithTimeout(url, options={}) {
    const { timeout = 8000 } = options;
    const controller = options.abort_controller || new AbortController();
    delete options.abort_controller;
    const id = setTimeout(() => controller.abort(), timeout);

    let resp;
    try {
      resp = await this.fetch(url, {
        ...options,
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

    if (resp.status !== 204 && resp.status !== 200) {
      let error = new Error(`CDL change propagation Error(${resp.status}):`);
      let json=''
      try  {
        json=await resp.json();
        error.message += JSON.stringify(json);
      } catch (e) {
        error.message += await resp.text();
      }
      if (resp.status === 408) {
        error.status=504;
      } else {
        error.status = 502;
      }
      throw error;
    }
    return resp;
  }

  async secret() {
    if ( ! this.cdl.secret) {
      const gs = new GoogleSecrets();
      let secrets = JSON.parse(await gs.getSecret(this.cdl.secretpath));
      secrets.forEach(s => {
        if (s["@id"] === this.cdl["@id"]) {
          this.cdl.secret = s;
        }
      });
    }
    if ( ! this.cdl.secret) {
      throw new Error('Could not find secret for '+this.instance);
    }
    return this.cdl.secret;
  }

  async service_account() {
    const secret = await this.secret();
    return secret.service_account;
  }

  async login() {

    function getLoginFields(html) {
      const dom = new JSDOM(html);

      let form = dom.window.document.querySelector('form');
      let fields = Array.from(form.querySelectorAll('input'));
      let postPath = form.getAttribute('action');
      let method = form.getAttribute('method');
      let usernameField = fields.filter(f => f.id === 'username')[0].getAttribute('name');
      let passwordField = fields.filter(f => f.id === 'password')[0].getAttribute('name');

      return {
        postPath,
        method,
        usernameField,
        passwordField
      };
    }

    const service_account = await this.service_account();
    if( !service_account.user || !service_account.pass ) {
      throw new Error('service_acount requires .user .pass');
    }

    // setup login cookies and session
    let resp = await this.fetchWithTimeout(this.cdl.host);
    // get return url
    let returnUrl = new URL(
      new URL(resp.url).searchParams.get('return')
    );

    // parse out entityId for non-uc login
    let dom = new JSDOM(await resp.text());
    let entityId = Array.from(dom.window.document.querySelectorAll('[data-entityid]'))
        .filter(node => node.innerHTML.trim().toLowerCase() === 'non-uc')
        .map(n => n.getAttribute('data-entityid'))[0];

    // add entityId to return url
    returnUrl.searchParams.set('entityID', entityId);

    resp = await this.fetchWithTimeout(returnUrl);

    // grab the login form fields and form path
    let respText = await resp.text();
    let { postPath, method, usernameField, passwordField } = getLoginFields(respText);
    let loginOrigin = new URL(resp.url).origin;
    let loginUrl = loginOrigin+postPath;

    // set the login username/password
    let formData = new URLSearchParams();
    formData.append(usernameField, service_account.user);
    formData.append(passwordField, service_account.pass);
    formData.append('_eventId_proceed',	'');

    //console.log('loginUrl\n', loginUrl, '\nformData\n', formData);

    // submit login form, this will redirect with saml request fields
    resp = await this.fetchWithTimeout(loginUrl, {
      method: method.toUpperCase(),
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    dom = new JSDOM(await resp.text());

    // finish saml request
    let samlOrigin = new URL(resp.url).origin;
    let form = dom.window.document.querySelector('form');
    let samlUrl = form.getAttribute('action');
    let samlMethod = form.getAttribute('method').toUpperCase() || 'POST';
    formData = new URLSearchParams();
    Array.from(form.querySelectorAll('input'))
      .forEach(input => formData.append(input.getAttribute('name'), input.getAttribute('value')));

    if( !samlUrl.match(/^http(s)?:\/\//) ) {
      samlUrl = samlOrigin + samlUrl;
    }

    // create a new AbortController for each request
    const controller = new AbortController();

    resp = await this.fetchWithTimeout(samlUrl, {
      method : samlMethod,
      body: formData.toString(),
      abort_controller: controller,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    //console.log(`login ${this.userId} status ${resp.status} ${resp.redirected ? 'redirected' : ''}`);
    // abort if we get a redirect
    controller.abort();
    return resp;
  }

  async impersonate() {
    // Get the impersonation token's via cookie
    let resp = await this.fetchWithTimeout(`${this.cdl.host}/impersonate.html?ii=false`);
    let csrfToken;
    try {
      let text=await resp.text();
      // remove error causing script
      text=text.replace('<script>jQuery.noConflict();</script>', '');
      //console.log('text\n', text);
      csrfToken = new JSDOM(text, {runScripts: "dangerously"}).window.SYMPLECTIC.csrfToken;
    } catch(e) {
    }

    let formData = new URLSearchParams();
    formData.append('__csrf_token', csrfToken);
    formData.append('user-id', this.userId);
    formData.append('com', 'impersonate');

    const controller = new AbortController();

    resp = await this.fetchWithTimeout(`${this.cdl.host}/impersonate.html`, {
      method: 'POST',
      body: formData,
      abort_controller: controller,
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    //console.log(`impersonate ${this.userId} status ${resp.status} ${resp.redirected ? 'redirected' : ''}`);
    controller.abort();
    return resp;
  }

  async profile() {
    if ( ! this.userId ) {
      throw new Error('Not impersonating any userId');
    }

    let resp = await this.fetchWithTimeout(`${this.cdl.host}/userprofile.html?uid=${this.userId}&em=true`);
    let html = await resp.text();
    // remove error causing script
    html=html.replace('<script>jQuery.noConflict();</script>', '');
    let dom = new JSDOM(html, {runScripts: "dangerously"});
    return dom.window.SYMPLECTIC
  }

  async editProfile(data) {
    let symplectic = await this.profile();
    let csrfToken = symplectic.csrfToken;

    let formData = new FormData();
    formData.append('__csrf_token', csrfToken);
    formData.append('com', 'updateFieldValues');
    formData.append('userId', userId);
    formData.append('fieldValues', JSON.stringify(data));

    let headers = formData.getHeaders();
    headers['accept'] = 'application/json';

    resp = await this.fetchWithTimeout(`${this.cdl.host}/userprofile.html`, {
      timeout: 20000,
      method: 'POST',
      body: formData,
      headers
    });

    return resp.text();
  }

  /**
   * @method userprofile - Generic user object updater
   * @param {object} data
   * @returns {Promise<Response>}
   */
  async userprofile(data) {
    const symplectic = await this.profile();
    const csrfToken = symplectic.csrfToken;

    const formData = new FormData();
    formData.append('__csrf_token', csrfToken);

    for (let key in data) {
      if (Array.isArray(data[key])) {
        formData.append(key, JSON.stringify(data[key]));
      } else {
        formData.append(key, data[key]);
      }
    }

    let headers = formData.getHeaders();
    headers['accept'] = 'application/json';

    console.log('formData', formData);
    let resp = await this.fetchWithTimeout(`${this.cdl.host}/userprofile.html`, {
      method: 'POST',
      body: formData,
      timeout: 20000,
      headers
    });

    let json = await resp.json();
    if (resp.status !== 200) {
      let error = new Error(`CDL change propagation Error(${resp.status}):`);
      logger.info('userprofile error', json);

      if (resp.status === 408) {
        error.status=504;
      } else {
        error.status = 502;
      }
      throw error;
    }
    return json;
  }

  /**
   * @method updateUserPrivacyLevel - Set the privacy of a user
   * @param {object}

   * @returns {Promise<Response>}
   */
  async updateUserPrivacyLevel(data) {
    const level = {
      public: 0,
      internal: 50
    };
    // use the userId you are impersonating
     return await this.userprofile({
       com: 'updateUserPrivacyLevel',
       userId: this.userId,
       privacyLevel: level[data.privacy]
    });
  }

  /**
   * @method updateUserAvailabilityLabels - Set the availability labels of a user
   * @param {object}

   * @returns {Promise<Response>}
   */
  async updateUserAvailabilityLabels(data={}) {
    // use the userId you are impersonating
    return await this.userprofile({
      com: 'updateLabels',
      userId: 292837, // TODO remove and use this.userId,
      schemeId: 17,
      labelsToAddOrEdit: data.labelsToAddOrEdit,
      labelsToRemove: data.labelsToRemove
    });
  }

  /**
   * @method listobjects - Generic user object updater
   * @param {object} data
   * @returns {Promise<Response>}
   */
  async listobjects(data) {
    const symplectic = await this.profile();
    const csrfToken = symplectic.csrfToken;

    const formData = new FormData();
    formData.append('__csrf_token', csrfToken);
    formData.append('adminMode', 'false');

    for (let key in data) {
        formData.append(key, data[key]);
    }

    let headers = formData.getHeaders();
    headers['accept'] = 'application/json';

    let resp = await this.fetchWithTimeout(`${this.cdl.host}/listobjects.html`, {
      method: 'POST',
      body: formData,
      headers
    });

    let json = await resp.json();
    if (resp.status !== 200) {
      let error = new Error(`CDL change propagation Error(${resp.status}):`);
      logger.info('listobjects error', json);

      if (resp.status === 408) {
        error.status=504;
      } else {
        error.status = 502;
      }
      throw error;
    }
    return json;
  }

  /**
   * @method setLinkPrivacy - Set the privacy of a link
   * @param {object}

   * @returns {Promise<Response>}
   */
  async setLinkPrivacy(data) {
    const level = {
      public: 0,
      internal: 50,
      private: 100,
    };
     return await this.listobjects({
      com: 'setLinkPrivacy',
       objectId: data.objectId,
       categoryId:data.categoryId,
      linkPrivacyLevel: level[data.privacy]
    });
  }

  async reject(data) {
    return await this.listobjects(
      {com: 'reject',
       linkId: data.linkId,
       categoryId: data.categoryId,
       objectId: data.objectId,
      });
  }

  async setFavourite(data) {
    return await this.listobjects(
      {com: 'setFavourite',
       objectId: data.objectId,
       favourite: (data.favourite ? 'true' : 'false')
      });
  }
}
