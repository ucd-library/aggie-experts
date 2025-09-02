const express = require('express');
// const {keycloak} = require('@ucd-lib/fin-service-utils');
const config = require('./config');
const path = require('path');

const app = express();

// app.use(keycloak.setUser);

// path to your spa assets dir
let assetsDir = path.join(__dirname, 'client', 'public');

app.use((req, res, next) => {
  let user = req.get('x-fin-user');
  if( typeof user === 'string' ) user = JSON.parse(user);

  // skip images/manifests
  if (/\.(png|jpg|jpeg|svg|json)$/i.test(req.url)) {
    next();
    return;
  }

  // if config.experts.isPublic is true, skip auth
  if( config.client.env.EXPERTS_IS_PUBLIC ) {
    next();
    return;
  }
  if( !user || !user['preferred_username'] ) {
    if( req.url !== '/' ) {
      res.redirect('/');
      return;
    } else {
      res.sendFile(assetsDir + '/login.html');
      return;
    }
  }

  next();
});

// require('./models/robots').middleware(app);
// require('./models/sitemap').middleware(app);

// const express = require('express');

// DEBUG: instrument Router to log any suspicious route/use registrations
(function instrumentExpressRoutes() {
  try {
    const Router = require('express').Router;
    const proto = Router && Router.prototype;
    if (!proto) return;

    const wrap = (name) => {
      const orig = proto[name];
      if (typeof orig !== 'function') return;
      proto[name] = function (path, ...args) {
        // normalize first arg if it's the path
        if (typeof path === 'string') {
          if (path.includes('?') || path.startsWith('http://') || path.startsWith('https://')) {
            console.error(`[ROUTE-INSTRUMENT] ${name} called with suspicious path:`, path);
            console.error(new Error().stack.split('\n').slice(2,6).join('\n'));
          }
        }
        return orig.call(this, path, ...args);
      };
    };

    ['use', 'get', 'post', 'put', 'delete', 'patch', 'all', 'route'].forEach(wrap);
    console.log('[ROUTE-INSTRUMENT] installed');
  } catch (e) {
    // noop
  }
})();

(function debugRouterParseErrors() {
  try {
    const express = require('express');
    const Router = express.Router;
    const proto = Router && Router.prototype;
    if (!proto) return;

    const wrap = (name) => {
      const orig = proto[name];
      if (typeof orig !== 'function') return;
      proto[name] = function (path, ...args) {
        const preview = (p) => {
          try {
            if (Array.isArray(p)) return `[array:${p.length}] ${JSON.stringify(p.slice(0,5))}`;
            return String(p);
          } catch (e) { return String(p); }
        };
        try {
          return orig.call(this, path, ...args);
        } catch (err) {
          // Log full debugging info then rethrow
          console.error('[ROUTE-PARSE-ERROR] when calling', name, 'with path:', preview(path));
          console.error('[ROUTE-PARSE-ERROR] typeof path:', typeof path);
          if (Array.isArray(path)) {
            path.forEach((p,i)=> console.error(`[ROUTE-PARSE-ERROR] path[${i}] =>`, preview(p)));
          } else {
            console.error('[ROUTE-PARSE-ERROR] path value =>', preview(path));
          }
          console.error('[ROUTE-PARSE-ERROR] stack (where registered):\n', (new Error()).stack.split('\n').slice(2,8).join('\n'));
          // rethrow original error so behavior remains the same
          throw err;
        }
      };
    };

    ['use','get','post','put','delete','patch','all','route'].forEach(wrap);
    console.log('[ROUTE-PARSE-ERROR] instrumentation installed');
  } catch (e) {
    // noop
  }
})();

// setup static routes
require('./controllers/static')(app);

app.listen(3000, () => {
  console.log('server ready on port 3000');
});
