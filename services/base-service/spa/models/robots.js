class RobotsModel {

  /**
   * @method middleware
   * @description wireup middleware for robots.txt
   * 
   * @param {Object} app express app instance
   */
  middleware(app) {    
    app.get('/robots.txt', (req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send(`User-agent: * 
Allow: /
Crawl-delay: 30
`);
    });
  }
}

module.exports = new RobotsModel();