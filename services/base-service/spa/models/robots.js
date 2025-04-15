const config = require('../config');

class RobotsModel {

  /**
   * @method middleware
   * @description wireup middleware for robots.txt
   * 
   * @param {Object} app express app instance
   */
  middleware(app) {   
    let allow = `Disallow: /api/search
Disallow: /search
Disallow: /browse
Disallow: /auth
Disallow: /fin/admin/
Disallow: /fcrepo/rest/
Disallow: /grant
Disallow: /work
    `;

    app.get('/robots.txt', (req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send(`User-agent: * 
${allow}
Crawl-delay: 30

Sitemap: https://experts.ucdavis.edu/sitemap.xml`
      );
    });
  }
}

module.exports = new RobotsModel();