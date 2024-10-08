const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const GrantModel = require('./model.js');
const utils = require('../utils.js')
const {defaultEsApiGenerator} = dataModels;
const template = require('./template/grant_name.json');

const { openapi, schema_error, json_only, user_can_edit, is_user, valid_path, valid_path_error } = require('../middleware.js')

const model = new GrantModel();

// not sure we should include this in the API
//router.use(openapi);

router.route(
  '/browse',
).get(
  is_user,
  valid_path(
    {
      description: "Returns counts for experts A - Z, or if sending query param p={letter}, will return results for experts with last names of that letter",
      parameters: ['p', 'page', 'size'],
      responses: {
        "200": openapi.response('Browse'),
        "400": openapi.response('Invalid_request')
      }
    }
  ),
  valid_path_error,
  async (req, res) => {
    const params = {
      size: 25
    };
    ["size","page","p"].forEach((key) => {
      if (req.query[key]) { params[key] = req.query[key]; }
    });

    if (params.p) {
      const opts = {
        index: "grant-read",
        id: "name",
        params
      };

      try {
        await model.verify_template(template);
        const find = await model.search(opts);
        res.send(find);
      } catch (err) {
        res.status(400).send('Invalid request');
      }
    } else {
      try {
        await model.verify_template(template);
        const search_templates=[];
        ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O",
         "P","Q","R","S","T","U","V","W","X","Y","Z"].forEach((letter) => {
           search_templates.push({});
           search_templates.push({id:"name",params:{p:letter,size:0}});
         });
        const finds = await model.msearch({search_templates});
        res.send(finds);
      } catch (err) {
        res.status(400).send('Invalid request');
      }
    }
  }
);


router.route(
  '/:grantId'
).get(
//  is_user,
  valid_path(
    {
      description: "Get a grant by id",
      responses: {
        "200": openapi.response('Grant'),
        "404": openapi.response('not_found')
      }
    }
  ),
 valid_path_error,
  async (req, res, next) => {
    const grantId=req.params.grantId;
    try {
      res.thisDoc = await model.get(grantId);
      next();
    } catch (e) {
      return res.status(404).json(`${grantId} resource not found`);
    }
  },
  (req, res) => {
    res.status(200).json(res.thisDoc);
  }
)
module.exports = router;
