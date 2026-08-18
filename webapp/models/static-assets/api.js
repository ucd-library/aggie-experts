const router = require('express').Router();
const { user_can_edit } = require('../middleware/index.js');
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
).post(
  user_can_edit,
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
