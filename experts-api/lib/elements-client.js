import GoogleSecrets from './google-secrets.js';
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fetchCookie = require('fetch-cookie');
const nodeFetch = require('node-fetch');

export default class ElementsClient {
    static const config = {
      cdl: {
        qa: {
          url : 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
          authname : 'qa-oapolicy',
          secretpath : 'projects/326679616213/secrets/cdl_elements_json'
        },
        prod: {
          url : 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
          authname : 'oapolicy',
          secretpath : 'projects/326679616213/secrets/cdl_elements_json'
        }
      }
    };

  static info(instance) {
    return config.cdl[instance];
  }

  // TODO: add elements info
  constructor(args={}) {
    this.instance = args.instance || 'prod';
    this.cdl = ElementsClient.info(this.instance);
    // New fetch instance with empty cookie jar
    this.fetch = fetchCookie(nodeFetch, new fetchCookie.toughCookie.CookieJar());
  }

  async secret() {
    if ! (this.cdl.secret) {
      const gs = new GoogleSecrets();
      let secretResp = await gs.getSecret(this.cdl.secretpath);
      this.cdl.secret = JSON.parse(secretResp);
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
    if( !serviced_account.username || !service_account.password ) {
      throw new Error('service_acount requires .username .password');
    }

    // setup login cookies and session
    let resp = await this.fetch(this.cdl.url);
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

    // get login form
    resp = await this.fetch(returnUrl.toString());

    // grab the login form fields and form path
    let { postPath, method, usernameField, passwordField } = getLoginFields(await resp.text());
    let loginOrigin = new URL(resp.url).origin;
    let loginUrl = loginOrigin+postPath;

    // set the login username/password
    let formData = new URLSearchParams();
    formData.append(usernameField, username);
    formData.append(passwordField, password);
    formData.append('_eventId_proceed',	'');

    // submit login form, this will redirect with saml request fields
    resp = await this.fetch(loginUrl, {
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

    resp = await this.fetch(samlUrl, {
      method : samlMethod,
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }
}
