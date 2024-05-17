const router = require('express').Router();
const {middleware} = require('@ucd-lib/fin-service-utils');
const model = require('./model.js');
const utils = require('../utils.js')

// router.post('/', middleware.finac.esRoles, async (req, res) => {
//   if( !req.body ) {
//     return res.json({error: true, message: 'no body sent'});
//   }

//   try {
//     res.json(await model.search(req.body, {
//       allRecords: req.query.all,
//       debug: req.query.debug
//     }));
//   } catch(e) {
//     res.json(utils.errorResponse(e, 'Error with search query'));
//   }
// });

// router.get('/*', middleware.finac.esRoles, async (req, res) => {
//   let id = decodeURIComponent(req.path);
//   id=id.replace(/^\//, '');

//   if( !id ) {
//     return res.json({error: true, message: 'no id sent'});
//   }

//   try {
//     // Need to review ES FIN get
//     let opts = {
//       seo : (req.query.seo || req.query.schema) ? true : false,
//       admin : req.query.admin ? true : false,
//       compact : req.query.compact ? true : false,
//       singleNode : req.query['single-node'] ? true : false,
//       roles : req.esRoles
//     }

//     //    let result = await model.get(id, opts);
//     let result = await model.get(id);
//     if( !result ) {
//       return res.status(404).send('Unknown id: '+id);
//     }

//     res.json(result);
//   } catch(e) {
//     res.json(utils.errorResponse(e, 'Error retrieving record: '+id));
//   }
// });

module.exports = router;
