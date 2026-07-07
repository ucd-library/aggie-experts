const router = require('express').Router();
const ExpertModel = require('./model.js');
// const {defaultEsApiGenerator} = dataModels;
// const md5 = require('md5');
const model = new ExpertModel();

const { browse_endpoint, item_endpoint } = require('../middleware/index.js');
const { json_only, user_can_edit, public_or_is_user } = require('../middleware/index.js')

function subselect(req, res, next) {
  try {
    // parse params
    let params = Object.assign({}, req.params || {}, req.query || {}, req.body || {});
    if( params.options ) {
      params = Object.assign(params, JSON.parse(params.options));
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

router.patch('/:expertId/availability',
  user_can_edit,
  json_only,
  async (req, res, next) => {
    expertId = `expert/${req.params.expertId}`;
    let data = req.body;
    try {
      let resp = await model.patchAvailability(data, expertId);
      res.status(204).json();
    } catch(e) {
      next(e);
    }
  }
)


router.route(
  '/:expertId/:relationshipId'
).patch(
  user_can_edit,
  json_only,
  async (req, res, next) => {
    let expertId=`expert/${req.params.expertId}`
    let data = req.body;

    try {
      let resp;
      let role_model;
      if( data.grant ) {
        role_model = model.grantRole();
      } else {
        role_model = model.Authorship();
      }
      patched=await role_model.patch(data,expertId);
      res.status(204).json();
//      res.status(200).json({status: 'ok'});
    } catch(e) {
      next(e);
    }
  }
).delete(
  user_can_edit,
  async (req, res, next) => {
    // logger.info(`DELETE ${req.url}`);

    try {
      let expertId = `expert/${req.params.expertId}`;
      let id = req.params.relationshipId;

      await model.Authorship().delete(id, expertId);
      res.status(200).json({status: "ok"});
    } catch(e) {
      next(e);
    }
  }
);

// this is taken from the middleware/index.js item_endpoint function
// just creating a simple route for now to return all expert graph data,
// optionally including "is-visible":false for admins/profile owner
// ?include=hidden&all
router.route(
  '/:expertId'
).get(
  public_or_is_user,
  async (req, res, next) => {
    let expertId = `expert/${req.params.expertId}`;
    let includeHidden = req.query['include'] === 'hidden';
    let all = false;
    if( 'all' in req.query ) {
      all = true;
    }
    let options = {};
    if( req.query['previewEsIndex'] ) options.previewEsIndex = req.query['previewEsIndex'];

    // only logged in user/admin can specify to include non-visible entries (using url param 'is-visible=include')
    // and (for now) only owner/admin can ask for the complete record (all grants/works, using url param 'all')
    let userCanEdit = req.user?.roles?.includes('admin') || expertId === req.user?.attributes?.expertId;
    let userLoggedIn = req.user;

    if( !userLoggedIn && !userCanEdit ) includeHidden = false;
    if( !userCanEdit && all ) all = false;

    let subselectOptions = {
      'is-visible': !includeHidden,
      expert : { include : true },
      grants : { include : true },
      works : { include : true }
    };

    if( userCanEdit ) {
      subselectOptions.admin = true;
    }

    if( !all ) {
      subselectOptions.grants.page = 1;
      subselectOptions.grants.size = 5;
      subselectOptions.works.page = 1;
      subselectOptions.works.size = 10;
    }

    try {
      res.thisDoc = await model.get(expertId, options);
      res.thisDoc = model.subselect(res.thisDoc, subselectOptions);
      res.status(200).json(res.thisDoc);
    } catch (e) {
      return res.status(404).json(`${expertId} resource not found`);
    }
  }
)


router.route(
  '/:expertId'
).post(
  public_or_is_user,
  async (req, res, next) => {
    let expertId = `expert/${req.params.expertId}`;
    let options = {};
    if( req.query['previewEsIndex'] ) options.previewEsIndex = req.query['previewEsIndex'];

    try {
      res.thisDoc = await model.get(expertId, options);
      next();
    } catch (e) {
      return res.status(404).json(`${req.path} resource not found`);
    }
  },
  subselect, // filter results
  (req, res) => {
    res.status(200).json(res.thisDoc);
  }
).patch(
  user_can_edit,
  json_only,
  async (req, res, next) => {
    expertId = `expert/${req.params.expertId}`;
    let data = req.body;
    try {
      let resp;
      patched=await model.patch(data,expertId);
      res.status(204).json();
    } catch(e) {
      next(e);
    }
  }
).delete(
  user_can_edit,
  async (req, res, next) => {
    try {
      let expertId = `expert/${req.params.expertId}`;
      await model.delete(expertId);
      res.status(204).json({status: "ok"});
    } catch(e) {
      next(e);
    }
  }
);

module.exports = router;
