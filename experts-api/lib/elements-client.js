const jsdom = require("jsdom");
const { JSDOM } = jsdom;

export default class ElementsClient {
  // TODO: add elements info
  constructor(args={}) {
    this.fetch = args.fetch || require('node-fetch');
    this.login = args.login || require('./login.js');
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

//    let username = args.username || process.env.USERNAME;
//    let password = args.password || process.env.PASSWORD;
    let {fetch, host} = args;

    if( !username || !password ) {
      throw new Error('Username and password are required to login');
    }

    // setup login cookies and session
    let resp = await fetch(`${host}`);
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
    resp = await fetch(returnUrl.toString());

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
    resp = await fetch(loginUrl, {
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

    resp = await fetch(samlUrl, {
      method : samlMethod,
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }
}
