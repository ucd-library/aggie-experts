const router = require('express').Router();
const { browse_endpoint, item_endpoint } = require('../middleware/index.js')
const { public_or_is_user } = require('../middleware/index.js')

const WorkModel = require('./model.js');
const model = new WorkModel();

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

router.get(
  '/search',
  public_or_is_user,
  async (req, res) => {
    const template=model.search_template;
    delete(template.query);
    const params = {
      index: [ model.readIndexAlias ]
    };
    ["p","inner_hit_size","size","page","q"].forEach((key) => {
      if (req.query[key]) { params[key] = req.query[key]; }
    });

    opts = {
      id: template.id,
      params
    };
//    try {
      await model.verify_template(template);
      const find = await model.search(opts);
      res.send(find);
//    } catch (err) {
//      res.status(400).send('Invalid request');
//    }
  });


browse_endpoint(router,model);
item_endpoint(router,model,subselect);

module.exports = router;
