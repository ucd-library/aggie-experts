import GoogleSecrets from './google-secret.js';
import config from './config.js';
import FormData from 'form-data';
import { JSDOM } from 'jsdom';
import fetchCookie from 'fetch-cookie';
import nodeFetch from 'node-fetch';
import AbortController from 'abort-controller';
import { logger } from './logger.js';

// TODO
// merge this with ./extract/cdl.js
// but for now, the webapp will use this file for cdl updates

export default class ElementsClient {

  static impersonators =
    {
      qa:{},
      prod:{}
    };

  static info(instance) {
    return config.cdl[instance];
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
    this.apiUrl = this.cdl?.url;
    this.webUrl = this.cdl?.host;
    this.localLoginUrl = this.cdl?.localLoginPath ? `${this.cdl.host}${this.cdl.localLoginPath}` : null;

    // Impersonation/login endpoints are on the web host, not the secure API path.
    if( !this.webUrl && this.apiUrl ) {
      try {
        const parsedApiUrl = new URL(this.apiUrl);

        // CDL interactive login/impersonation pages are served from the web host,
        // while the API typically lives under /elements-secure-api on port 8002.
        if( parsedApiUrl.pathname.includes('/elements-secure-api/') ) {
          this.webUrl = `${parsedApiUrl.protocol}//${parsedApiUrl.hostname}`;
        } else {
          this.webUrl = parsedApiUrl.origin;
        }
      } catch (e) {
      }
    }

    if( !this.webUrl ) {
      throw new Error(`Missing CDL web host/url for instance: ${this.instance}`);
    }

    this.cookie_jar=new fetchCookie.toughCookie.CookieJar();
    this.fetch = fetchCookie(nodeFetch, this.cookie_jar);
    this.userId=userId;
    // create expiration date 1 hour from now
    this.expires=Date.now() + 1000 * 60 * 60; // 1 hour
  }

  async fetchWithTimeout(url, options={}) {
    const { timeout = this.cdl?.timeout || 8000 } = options;
    const controller = options.abort_controller || new AbortController();
    delete options.abort_controller;
    const id = setTimeout(() => controller.abort(), timeout);

    let resp;
    try {
      resp = await this.fetch(url, {
        ...options,
        headers: {
          // CDL's front end appears to serve a "browser not supported" stub
          // (no login form) to non-browser User-Agents.
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          ...options.headers
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

    if (resp.status !== 204 && resp.status !== 200) {
      const error = new Error(`CDL change propagation Error(${resp.status}):`);
      const bodyText = await resp.text();

      const headers = Object.fromEntries(resp.headers.entries());
      delete headers['set-cookie'];

      logger.info('ElementsClient.fetchWithTimeout non-200 response', {
        instance: this.instance,
        url,
        status: resp.status,
        redirected: resp.redirected,
        bodyLength: bodyText.length,
        bodySnippet: bodyText.slice(0, 500),
        headers
      });

      try {
        const parsed = JSON.parse(bodyText);
        error.message += JSON.stringify(parsed);
      } catch {
        error.message += bodyText;
      }

      error.status = resp.status === 408 ? 504 : 502;
      throw error;
    }
    return resp;
  }

  async secret() {
    if ( !this.cdl.secret ) {
      let secrets = JSON.parse(await GoogleSecrets.getSecret(this.cdl.secretName));

      secrets.forEach(s => {
        if( s["@id"] === this.cdl.authname ) {
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
    const service_account = await this.service_account();

    if( !service_account.user || !service_account.pass ) {
      throw new Error('service_acount requires .user .pass');
    }

    // The login page itself is now a client-rendered React app (no server-rendered
    // <form> to scrape), but the POST target/fields are static (com=login, username,
    // password) and the response still embeds a window.SYMPLECTIC JSON blob — same
    // as impersonate()/profile() below — so we read login success/failure from that
    // instead of looking for a login form in the response HTML.
    let resp = await this.fetchWithTimeout(this.localLoginUrl);

    let formData = new URLSearchParams();
    formData.set('com', 'login');
    formData.set('username', service_account.user);
    formData.set('password', service_account.pass);

    resp = await this.fetchWithTimeout(this.localLoginUrl, {
      method: 'POST',
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const loginRespText = await resp.text();
    let symplectic;
    try {
      symplectic = new JSDOM(loginRespText, {runScripts: 'dangerously'}).window.SYMPLECTIC;
    } catch (e) {
    }

    const loginError = symplectic?.boilerplateData?.oneTimeJson?.loginErrorState;
    if( loginError ) {
      const message = symplectic.boilerplateData.oneTimeJson.loginErrorMessage || 'credentials may be rejected';
      throw new Error(`Local login did not succeed — ${message}`);
    }

    return resp;
  }

  /**
   * @method getCsrfToken
   * @description CDL no longer embeds a CSRF token in server-rendered HTML
   * (window.SYMPLECTIC.csrfToken); it's now served as a plain-text body from
   * a dedicated endpoint, tied to the current session cookie.
   * @returns {Promise<string>}
   */
  async getCsrfToken() {
    const resp = await this.fetchWithTimeout(`${this.webUrl}/csrf`);
    return (await resp.text()).trim();
  }

  async impersonate() {
    const csrfToken = await this.getCsrfToken();

    let formData = new URLSearchParams();
    formData.append('__csrf_token', csrfToken);
    formData.append('user-id', this.userId);
    formData.append('com', 'impersonate');

    const controller = new AbortController();

    let resp = await this.fetchWithTimeout(`${this.webUrl}/impersonate.html`, {
      method: 'POST',
      body: formData,
      abort_controller: controller,
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    logger.info('ElementsClient.impersonate post debug', {
      instance: this.instance,
      userId: this.userId,
      postStatus: resp.status,
      redirected: resp.redirected
    });
    //console.log(`impersonate ${this.userId} status ${resp.status} ${resp.redirected ? 'redirected' : ''}`);
    controller.abort();
    return resp;
  }

  async profile() {
    if ( ! this.userId ) {
      throw new Error('Not impersonating any userId');
    }

    let resp = await this.fetchWithTimeout(`${this.webUrl}/userprofile.html?uid=${this.userId}&em=true`);
    let html = await resp.text();
    // remove error causing script
    html=html.replace('<script>jQuery.noConflict();</script>', '');
    let dom = new JSDOM(html, {runScripts: "dangerously"});
    return dom.window.SYMPLECTIC
  }

  async editProfile(data) {
    let csrfToken = await this.getCsrfToken();

    let formData = new FormData();
    formData.append('__csrf_token', csrfToken);
    formData.append('com', 'updateFieldValues');
    formData.append('userId', userId);
    formData.append('fieldValues', JSON.stringify(data));

    let headers = formData.getHeaders();
    headers['accept'] = 'application/json';

    resp = await this.fetchWithTimeout(`${this.webUrl}/userprofile.html`, {
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
    const csrfToken = await this.getCsrfToken();

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

    let resp = await this.fetchWithTimeout(`${this.webUrl}/userprofile.html`, {
      method: 'POST',
      body: formData,
      timeout: 20000,
      headers
    });

    // strip bom character if present before parsing json
    let text = await resp.text();
    text = text.replace(/^\uFEFF/, '');
    let json = JSON.parse(text);
    
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
      userId: this.userId,
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
    const csrfToken = await this.getCsrfToken();

    const formData = new FormData();
    formData.append('__csrf_token', csrfToken);
    formData.append('adminMode', 'false');

    for (let key in data) {
        formData.append(key, data[key]);
    }

    let headers = formData.getHeaders();
    headers['accept'] = 'application/json';

    let resp = await this.fetchWithTimeout(`${this.webUrl}/listobjects.html`, {
      method: 'POST',
      body: formData,
      headers
    });

    // Strip BOM if present before parsing JSON
    let text = await resp.text();
    text = text.replace(/^\uFEFF/, '');
    let json = JSON.parse(text);

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
       categoryId: data.categoryId,
       favourite: (data.favourite ? 'true' : 'false')
      });
  }
}
