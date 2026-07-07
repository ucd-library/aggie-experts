const router = require('express').Router();

const { browse_endpoint, item_endpoint } = require('../middleware/index.js');

const GrantModel = require('./model.js');
const model = new GrantModel();

function subselect(req, res, next) {
  try {
    let params= {
      'is-visible': true
    };
    if (req.query["is-visible"]) {
      params['is-visible'] = req.query["is-visible"];
    }

    // only allow no-sanitize if they are an admin or the expert
    let expertId = `${req.params.expertId}`;
    params.admin = req.user?.roles?.includes('admin') || expertId === req?.user?.attributes?.expertId;

    res.thisDoc = model.subselect(res.thisDoc, params);
    next();
  } catch (e) {
    res.status(e.status || 500).json({error:e.message});
  }
}

browse_endpoint(router,model);
item_endpoint(router,model,subselect);

module.exports = router;
