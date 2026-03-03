const config = require('.../../commons/config.js.js');
const logger = require('.../../commons/logger.js.js');
const express = require('express');
// const bodyParser = require('body-parser');
const cors = require('cors');
const auth = require('./oidc.js');
const httpProxy = require('http-proxy');
const {logReqMiddleware} = require('@ucd-lib/logger');
const keycloak = require('../keycloak.js');
const cookieParser = require('cookie-parser');

logger.debug('Initializing gateway proxy');

const app = express();

// JM - TODO: do we have advanced cors needs?
app.use(cors());
app.use(cookieParser());
app.use(logReqMiddleware(logger, {
  debug : [/^\/health\/?/]
}));
// app.use(bodyParser.json());

// setup proxy
let proxy = httpProxy.createProxyServer({
  ignorePath : false,
  timeout: config.webappProxy.timeout,
  proxyTimeout: config.webappProxy.proxyTimeout,
});
proxy.on('error', e => {
  logger.error('http-proxy error', e.message, e.stack);
});

// setup oidc auth
auth(app);

app.use(keycloak.setUser);

app.use('/api', (req, res) => {
  proxy.web(req, res, {
    target : config.api.serviceHost
  });
});

// send all requests that are not /auth or /api to the ClientService
app.use((req, res) => {
  proxy.web(req, res, {
    target : config.client.serviceHost
  });
});

app.listen(config.webappProxy.port, () => {
  logger.info(`Proxy server listening on port ${config.webappProxy.port}`);
});
