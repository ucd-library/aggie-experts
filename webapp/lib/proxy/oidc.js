const { auth } = require('express-openid-connect');
const config = require('../config.js');
const logger = require('../logger.js');
const keycloak = require('../keycloak.js');

function init(app) {

  // always set long hashes as secret:
  // openssl rand -base64 512 | tr -d '\n'
  // add policy to expire secret after one year.
  app.post('/auth/'+config.oidc.serviceName+'/service-account/token', async (req, res) => {
    let loginResp = await keycloak.loginServiceAccount(
      req.body.username, req.body.secret
    );

    // strip id_token, don't have 3rd party users bother with this.
    if( loginResp.status === 200 ) {
      if( loginResp.body.id_token ) {
        delete loginResp.body.id_token;
      }
      if( loginResp.body.refresh_token ) {
        delete loginResp.body.refresh_token;
      }
    }

    res
      .status(loginResp.status)
      .json(loginResp.body);
  });

  app.use(auth({
    issuerBaseURL: config.oidc.baseUrl,
    baseURL: config.url,
    clientID: config.oidc.clientId,
    clientSecret: config.oidc.secret,
    secret : config.jwt.secret,
    routes : {
      callback : '/auth/'+config.oidc.serviceName+'/callback',
      login : '/auth/'+config.oidc.serviceName+'/login',
      logout : '/auth/'+config.oidc.serviceName+'/logout',
      postLogoutRedirect : '/auth/'+config.oidc.serviceName+'/postLogoutRedirect'
    },
    authorizationParams: {
      response_type: 'code',
      scope : config.oidc.scopes
    },
    idpLogout: true,
    afterCallback : (req, res, session, decodedState) => {
      res.set('X-FIN-AUTHORIZED-TOKEN', session.access_token);
      return session
    }
  }));

}

module.exports = init;