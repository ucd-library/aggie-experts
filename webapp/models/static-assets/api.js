const router = require('express').Router();
const model = require('./model.js');

router.route(
  '/faq-markdown'
).get(
  async (req, res) => {
    try {
      res.type('text/markdown').send(await model.getFaqMarkdown());
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  }
);

router.route(
  '/faq-markdown/refresh'
).get(
  async (req, res) => {
    try {
      await model.refreshFaqMarkdown();
      res.status(200).json({ message: 'FAQ cache refreshed' });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  }
);

module.exports = router;
