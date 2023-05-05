const express = require('express');
const app = express();

// setup static routes
require('./controllers/static')(app);

app.listen(3000, () => {
  console.log('server ready on port 3000');
});
