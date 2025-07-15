const config = require('../config');
let experts = require('../../models/expert/index.js');

experts = experts.model;

class SitemapModel {

  /**
   * @method middleware
   * @description wireup middleware for sitemap
   *
   * @param {Object} app express app instance
   */
  middleware(app) {
    let sitemap = '';

    if( config.server.url.match('https://experts.ucdavis.edu') ) {
      sitemap = `Sitemap: ${config.server.url}/sitemap.xml`;
    }

    app.get(/^\/sitemap.*/, (req, res) => this._onRequest(req, res));
  }

  /**
   * @method _onRequest
   * @description handle any request that starts with /sitemap.  Bound
   * to express app route above
   *
   * @param {Object} req express request
   * @param {Object} res express response
   */
  async _onRequest(req, res) {
    let expert = req.url
      .replace(/^\/sitemap/, '')
      .replace(/\.xml$/, '');

    res.set('Content-Type', 'application/xml');

    try {
      // no expert provided, set the root sitemapindex for all experts
      if( !expert ) {
        // return res.send(await this.getRoot());
        return res.send(await this.getExperts());
      }

      expert = expert.replace(/^-/,'');

      // send express response, we are going to stream out the xml result
      this.getExpert(expert.replace(/^-/,''), res);
    } catch(e) {
      res.set('Content-Type', 'application/json');
      res.status(500).json({
        error : true,
        message : e.message,
        stack : e.stack
      });
    }
  }

  /**
   * @method getExperts
   *
   */
  async getExperts() {
    let sitemaps = await experts.esSearch({
      from : 0,
      size : 10000,
      _source : false
    });

    let hits = sitemaps.hits.hits || [];
    sitemaps = hits.map(result => `<sitemap>
        <loc>${config.server.url}/sitemap-${result._id.replace('/expert/','')}.xml</loc>
    </sitemap>`);

        return `<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${sitemaps.join('\n')}
    </sitemapindex>`;
  }

  /**
   * @method getExpert
   * @description create sitemap file for an expert
   * @param {String} id expert slug
   * @param {Object} resp express response object
   *
   * @returns {Promise} resolves to xml string
   */
  async getExpert(id, resp) {
    // set xml header
    resp.write(`<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);

    // create our es query
    let query = {
        bool: {
            filter: [
                {term: {'@id': `${id}`}}
            ]
        }
    };

    let result = await experts.esSearch({
        _source : ['name'],
        query : query
    });
    result.hits.hits.forEach(result => {
        // loop expert @graph and link to each work/grant
        let graph = result._source['@graph'] || [];

        // for now we're just doing sitemaps for experts, might expand later
        this._writeResult(resp, graph[0]);

        // graph.forEach(g => {
        //     this._writeResult(resp, g);
        // });

    });

    // finish our sitemap xml and end response
    resp.write('</urlset>');
    resp.end();
  }

  /**
   * @method _writeResult
   * @description write a single result for sitemap
   *
   * @param {Object} resp express response
   * @param {Object} result elasticsearch record result
   */
  _writeResult(resp, result) {
    let id = result['@id'] || result._id;
    let resultType = 'expert';
    if( result['@type'] === 'Work' || result['@type'].includes('Work') ) {
        resultType = 'work';
    } else if( result['@type'] === 'Grant' || result['@type'].includes('Grant') ) {
        resultType = 'grant';
    }

    // for now we're just doing sitemaps for experts, might expand later
    if( resultType === 'expert' ) {
      resp.write(`<url>
          <loc>${config.server.url}/${resultType}/${id.replace('expert/', '')}</loc>
          <changefreq>weekly</changefreq>
          <priority>.5</priority>
      </url>\n`);
    }
  }

}

module.exports = new SitemapModel();
