const router = require('express').Router();
const { openapi } = require('../middleware.js')

//let SCHEMA=null;
let Schema=null;

router.route(
  '/:version?/context.jsonld'
).get(
  async (req, res) => {
    if (Schema === null) {
      const api = await import('@ucd-lib/experts-api');
      Schema=api.Schema;
    }
    try {
      const version = req.params.version || '2';
      const context=await Schema.context('expert',version)
      res.status(200).json(context);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
)

module.exports = router;
