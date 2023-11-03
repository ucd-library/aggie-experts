const express = require('express');
// const {keycloak} = require('@ucd-lib/fin-service-utils');
// const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
// const compression = require('compression');
const path = require('path');

const app = express();

// allow images to be served
// app.use(express.static(path.join(__dirname, 'client', 'public', 'images')));

// parse cookies and add compression
// app.use(cookieParser());
// app.use(compression());

// parse application/x-www-form-urlencoded req body
// app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json req body
// app.use(bodyParser.json());

// app.use(keycloak.setUser);

// path to your spa assets dir
let assetsDir = path.join(__dirname, 'client', 'public');

app.use((req, res, next) => {
  let user = req.get('x-fin-user');
  if( typeof user === 'string' ) user = JSON.parse(user);

  // skip images
  if (/\.(png|jpg|jpeg|svg)$/i.test(req.url)) {
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

// setup static routes
require('./controllers/static')(app);

app.listen(3000, () => {
  console.log('server ready on port 3000');
});
