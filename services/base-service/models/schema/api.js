const router = require('express').Router();
const { openapi } = require('../middleware.js')

let Config = null;
router.route(
  '/'
).get(
  async (req, res) => {
    if (Config === null) {
      const {config } = await import('@ucd-lib/experts-api');
      Config = config;
    }
    res.status(200).json(Config);
  }
)

router.route(
  '/:version'
).get(
  async (req, res) => {
      res.status(200).json({quinn: 'is_great',version: req.params.version})
  }
)

module.exports = router;
