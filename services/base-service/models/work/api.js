const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const WorkModel = require('./model.js');
const utils = require('../utils.js')
//const { browse_endpoint } = require('../middleware.js')
const { openapi, schema_error, json_only, user_can_edit, is_user, valid_path, valid_path_error } = require('../middleware.js')


const model = new WorkModel();
// module.exports = defaultEsApiGenerator(model, {router});

function browse_endpoint(router,model) {
  router.route(
    '/browse',
  ).get(
    is_user,
    valid_path(
      {
        description: `Returns for ${model.name} for  A - Z, or if sending query param p={letter}, will return results for ${model.name} with last names of that letter`,
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
        size: 25,
        index: model.readIndexAlias,
      };
      ["size","page","p"].forEach((key) => {
        if (req.query[key]) { params[key] = req.query[key]; }
      });

      if (params.p) {
        if (params.p === 'other') {
          params.p = '1';
        } else if (params.p.match(/^[a-zA-Z]/)) {
          params.p = params.p.substring(0,1);
        } else {
          params.p = '1';
        }

        const opts = {
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
          ["1","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O",
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
}

browse_endpoint(router,model);

module.exports = router;
