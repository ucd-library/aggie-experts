const router = require('express').Router();
const path = require('path');

const { dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const template = require('./template/modified-date.js');
const expert = new ExpertModel();
const base = new BaseModel();

const { defaultEsApiGenerator } = dataModels;

const {
  openapi,
  validate_admin_client,
  validate_miv_client,
  has_access,
  convertIds
} = require('../middleware/index.js')

const {
  siteFarmDefaultSearch,
  siteFarmFormat,
  siteFarmPreviewFormat,
  sitefarm_valid_path,
  sitefarm_valid_path_error
} = require('./utils.js');


// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(openapi);

router.get('/', (req, res) => {
  if( 'preview' in req.query ) {
    return res.sendFile(path.join(__dirname, 'swagger-preview.json'));
  }
  return res.sendFile(path.join(__dirname, 'swagger.json'));
});

router.get(
  '/experts/:ids',
  sitefarm_valid_path(
    {
      description: "Returns a JSON array of expert profiles",
      responses: {
        "200": openapi.response('Successful_operation'),
        "400": openapi.response('Invalid_ID_supplied'),
        "404": openapi.response('Expert_not_found')
      }
    }
  ),
  sitefarm_valid_path_error,
  validate_admin_client,
  validate_miv_client,
  has_access('sitefarm'),
  convertIds, // convert submitted iamIds to expertIds
  siteFarmDefaultSearch, // sets up search params including modified_since, base es search
  (req, res, next) => {
    if( 'preview' in req.query ) {
      return siteFarmPreviewFormat(req, res, next);
    }
    return siteFarmFormat(req, res, next);
  },
  (req, res) => {
    res.status(200).json(res.doc_array);
  }
);

const model = new ExpertModel();
module.exports = defaultEsApiGenerator(model, { router });

module.exports = router;
