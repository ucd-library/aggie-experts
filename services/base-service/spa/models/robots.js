const config = require('../config');

class RobotsModel {

  /**
   * @method middleware
   * @description wireup middleware for robots.txt
   * 
   * @param {Object} app express app instance
   */
  middleware(app) {   
    let allow = 'Disallow: /';    
    if( config.server.url.match('https://experts.ucdavis.edu') ) {
      allow = `Disallow: /api/search
    Disallow: /search
    Disallow: /auth
    Disallow: /fin/admin/`;
    } 

    app.get('/robots.txt', (req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send(`User-agent: * 
${allow}
Crawl-delay: 30
`);
    });
  }
}

module.exports = new RobotsModel();