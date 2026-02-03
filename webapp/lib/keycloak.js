const fetch = require('node-fetch');
const config = require('./config.js');
const logger = require('./logger.js');
const clone = require('clone');

class KeycloakUtils {

  constructor() {
    this.tokenCache = new Map();
    this.tokenRequestCache = new Map();
    this.tokenCacheTTL = config.oidc.tokenCacheTTL;
    this.maxTokenRequests = 3;

    this.setUser = this.setUser.bind(this);
    this.protect = this.protect.bind(this);
  }

  /**
   * @method getJwtFromRequest
   * @description given a express request object, return a given jwt token.
   * Method will first check the request cookies of the jwt token cookie then
   * checks the Authorization header of the token.
   *
   * @param {Object} req express request object
   *
   * @returns {String|null} null if no token found.
   */
  getJwtFromRequest(req) {
    let token;

    if( req.cookies ) {
      token = req.cookies[config.jwt.cookieName];
      if( token ) return token;
    }

    token = req.get('Authorization');
    if( token && token.match(/^Bearer /i) ) {
      return token.replace(/^Bearer /i, '');
    }

    return null;
  }

  /**
   * @method getServiceAccountToken
   * @description Get a service account token from fin
   */
  async getServiceAccountToken() {
    if( this.finServiceAccountToken ) {
      return this.finServiceAccountToken;
    }

    let resp = await this.loginServiceAccount(config.serviceAccount.username, config.serviceAccount.secret);
    if( resp.status === 200 ) {
      this.finServiceAccountToken = resp.body.access_token;

      setTimeout(() => this.finServiceAccountToken = null, 1000*60*60*12);

      return this.finServiceAccountToken;
    }

    let body = resp.body;
    if( typeof body === 'object' ) {
      body = JSON.stringify(body, null, 2);
    }
    throw new Error('Failed to get service account token: '+config.serviceAccount.username+'. '+resp.status+' '+body);
  }

  async loginServiceAccount(username, secret) {
    let apiResp = await fetch(config.oidc.baseUrl+'/protocol/openid-connect/token', {
      method: 'POST',
      headers:{
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type : 'password',
        client_id : config.oidc.clientId,
        client_secret : config.oidc.secret,
        username : username,
        password : secret,
        scope : config.oidc.scopes
      })
    });

    let json = await apiResp.json();

    return {
      body : json,
      status : apiResp.status
    }
  }

  async verifyActiveToken(token='') {
    token = token.replace(/^Bearer /i, '');

    // check token cache
    if( this.tokenCache.has(token) ) {
      let result = this.tokenCache.get(token);
      return clone(result);
    }

    // if we get multiple requests at once, just make one
    // request to the auth server
    if( this.tokenRequestCache.has(token) ) {
      let promise = this.tokenRequestCache.get(token);
      let result = await promise;

      return clone(result);
    }

    // check request already in progress
    let requestResolve, requestReject;
    let promise = new Promise((resolve, reject) => {
      requestResolve = resolve;
      requestReject = reject;
    });
    this.tokenRequestCache.set(token, promise);

    let attempt = 1;
    let result = {
      active : false,
      status : -1,
      user : null,
    }
    
    while( attempt <= this.maxTokenRequests ) {
      try {
        result = await this._verifyTokenRequest(token);
        break;
      } catch(e) {
        attempt++;
        if( attempt > this.maxTokenRequests ) {
          logger.fatal('Failed to verify token, max attempts reached: '+attempt, e);
        } else {
          logger.warn('Failed to verify token, retrying: '+attempt, e);
        }
      }
    }

    requestResolve(clone(result));
    return clone(result);
  }

  async _verifyTokenRequest(token) {
    let result;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    let request = fetch(config.oidc.baseUrl+'/protocol/openid-connect/userinfo', {
      signal: controller.signal,
      headers : {
        authorization : 'Bearer '+token
      }
    });


    let resp = await request;
    let body = await resp.text();

    // clear abort controller
    clearTimeout(timeoutId);

    result = {
      active : resp.status === 200,
      status : resp.status,
      user : body ? JSON.parse(body) : null
    }

    this.tokenCache.set(token, result);
    setTimeout(() => {
      this.tokenCache.delete(token);
    }, this.tokenCacheTTL);

    this.tokenRequestCache.delete(token);

    return clone(result);
  }

  async setUser(req, res, next) {
    if( req.get('x-fin-user') ) {
      req.user = JSON.parse(req.get('x-fin-user'));
      if( !req.user.roles ) req.user.roles = [];

      return next();
    }

    function fully_qualified_username(user) {
      if( user.includes('@') || !config.principal?.addDomain ) {
        return user;
      } else {
        return user+'@'+config.principal.addDomain;
      }
    }

    let token = this.getJwtFromRequest(req);
    if( !token ) return next();
    req.token = token;

    let resp = await this.verifyActiveToken(token);

    if( resp.active !== true ) return next();
    let user = resp.user;

    req.user = user;

    // override roles
    let roles = new Set();

    if( user.username ) {
      roles.add(user.username);
      if (config.principal?.addDomain && ! user.username.includes('@')) {
        roles.add(fully_qualified_username(user.username));
      }
    }
    if( user.preferred_username ) {
      roles.add(user.preferred_username);
      if (config.principal?.addDomain && ! user.preferred_username.includes('@')) {
        roles.add(fully_qualified_username(user.preferred_username));
      }
    }

    if( user.roles && Array.isArray(user.roles) ) {
      user.roles.forEach(role => roles.add(role));
    }

    if( user.realmRoles && Array.isArray(user.realmRoles) ) {
      user.realmRoles.forEach(role => roles.add(role));
      delete user.realmRoles;
    }

    user.roles = Array.from(roles)
      .filter(role => config.oidc.roleIgnoreList.includes(role) === false);

    req.headers['x-fin-user'] = JSON.stringify(user);

    next();
  }

  protect(roles=[]) {
    if( !Array.isArray(roles) ) {
      roles = [roles];
    }

    let authorize = function (req, res, next)  {
      this.setUser(req, res, () => {
        // no user
        if( !req.user ) return res.status(403).send();

        // there is a user and no roles required, good to go
        if( roles.length === 0 ) {
          return next();
        }

        for( let role of roles ) {
          if( req.user.roles.includes(role) ) {
            return next();
          }
        }

        return res.status(403).send();
      })
    };

    authorize = authorize.bind(this);
    return authorize;
  }

}

module.exports = new KeycloakUtils();
