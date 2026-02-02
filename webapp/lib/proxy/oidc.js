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

  app.get('/auth/postLogoutRedirect', (req, res) => {
    res.clearCookie(config.jwt.cookieName, {
      // httpOnly: false,
      secure: true,
      sameSite: 'Lax'
    });
    res.redirect('/');
  });

  app.use(auth({
    authRequired: false,
    issuerBaseURL: config.oidc.baseUrl,
    baseURL: config.url,
    clientID: config.oidc.clientId,
    clientSecret: config.oidc.secret,
    secret : config.jwt.secret,
    routes : {
      callback : '/auth/callback',
      login : '/auth/login',
      logout : '/auth/logout',
      postLogoutRedirect : '/auth/postLogoutRedirect'
    },
    authorizationParams: {
      response_type: 'code',
      scope : config.oidc.scopes
    },
    idpLogout: true,
    afterCallback : (req, res, session, decodedState) => {
      // set cookie for front-end access token use:
      res.cookie(config.jwt.cookieName, session.access_token, {
        // httpOnly: false,
        secure: true,
        sameSite: 'Lax',
        maxAge: config.jwt.ttl || (3600 * 1000)
      });

      return session
    }
  }));

}

module.exports = init;