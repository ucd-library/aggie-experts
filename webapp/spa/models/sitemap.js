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

    if( config.url.match('https://experts.ucdavis.edu') ) {
      sitemap = `Sitemap: ${config.url}/sitemap.xml`;
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
        // return res.send(await this.getExperts());
        return await this.getExperts(req, res);
      }

      expert = expert.replace(/^-/,'');

      // send express response, we are going to stream out the xml result
      this.getExpert(expert, req, res);
    } catch(e) {
      res.write('\nERROR: ' + (e.message || JSON.stringify(e)));
      res.end();
    }
  }

  _getBaseUrl(req) {
    const forwardedProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const proto = forwardedProto || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');

    if( host ) {
      return `${proto}://${host}`;
    }

    return config.url;
  }

  /**
   * @method getExperts
   *
   */
  async getExperts(req, resp) {
    let chunkSize = 1000;
    let time = '30s';
    const baseUrl = this._getBaseUrl(req);
    let result = await experts.client.search({
      index: experts.readIndexAlias,
      scroll: time,
      _source_includes: ['@id'],
      body: {
        from : 0,
        size: chunkSize,
        query: {
          term: {'is-visible': true}
        }
      }
    });

    resp.write(`<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);

    let hits = result.hits.hits || [];
    let sent = hits.length;
    hits.forEach(result => resp.write(`<url>
      <loc>${baseUrl}/expert/${result._id.replace(/^expert\//,'')}</loc>
      <changefreq>weekly</changefreq>
      <priority>.5</priority>
    </url>`));
    if (typeof resp.flush === 'function') resp.flush();

    while( chunkSize === sent ) {
      result = await experts.esScroll({
        scroll_id: result._scroll_id,
        scroll: time
      });

      hits = result.hits.hits || [];
      sent = hits.length;
        hits.forEach(result => resp.write(`<url>
          <loc>${baseUrl}/expert/${result._id.replace(/^expert\//,'')}</loc>
          <changefreq>weekly</changefreq>
          <priority>.5</priority>
        </url>`));
      if (typeof resp.flush === 'function') resp.flush();
    }

    // finish our sitemap xml and end response
    resp.write('</urlset>');
    resp.end();
  }

  /**
   * @method getExpert
   * @description create sitemap file for an expert
   * @param {String} id expert slug
   * @param {Object} resp express response object
   *
   * @returns {Promise} resolves to xml string
   */
  async getExpert(id, req, resp) {
    const baseUrl = this._getBaseUrl(req);

    // set xml header
    resp.write(`<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);

    const expertId = id.startsWith('expert/') ? id : `expert/${id}`;

    // create our es query
    let query = {
        bool: {
            filter: [
          {term: {'@id': `${expertId}`}},
          {term: {'is-visible': true}}
            ]
        }
    };

    let result = await experts.client.search({
      index: experts.readIndexAlias,
      body : {
        _source : ['@graph'],
        query : query
      }
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
          <loc>${baseUrl}/${resultType}/${id.replace('expert/', '')}</loc>
          <changefreq>weekly</changefreq>
          <priority>.5</priority>
      </url>\n`);
    }
  }

}

module.exports = new SitemapModel();
