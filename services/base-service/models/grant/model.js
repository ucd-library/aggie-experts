const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
/**
 * @class GrantModel
 * @description Base class for Aggie Experts data models.
 */
class GrantModel extends BaseModel {

  static transformed_types = [ 'Grant' ];

  static types = [
    "http://vivoweb.org/ontology/core#Grant"
  ];

  constructor(name='grant') {
    super(name);
  }

  snippet(node) {
    let snip=super.snippet(node);
    return snip;
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */
  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);
    const doc = this.promote_node_to_doc(root_node);

    const relatedBy = {};

    // combine relatedBy (ordered)
    function addRelatedBy(doc) {
      if (doc.relatedBy) {
        Array.isArray(doc.relatedBy) || (doc.relatedBy = [doc.relatedBy]);
        existing.relatedBy.forEach((rel) => {
          relatedBy[rel['@id']] = rel;
          });
      }
    }

    try {
      let existing = await this.client_get(doc['@id']);
      addRelatedBy(existing);
    } catch(e) {
    }
    addRelatedBy(doc);

    // for each value in relatedBy, if it has .inheres_in, fetch expert
    function nameMatches(expert) {
      const name_match={}
      let name=expert?.contactInfo?.hasName;
      let last=name.family.toLowerCase().replace(/[^a-z]/g,'');
      if (name.given && name.given.length) {
        let first=name.given.toLowerCase().replace(/[^a-z]/g,'');
        name_match[`${last}_${first}`]=expert;
        name_match[`${last}_$first[0]`]=expert;
        if (name.middle && name.middle.length) {
          let middle=name.middle.toLowerCase().replace(/[^a-z]/g,'');
          name_match[`${last}_${first[0]}${middle[0]}`]=expert;
        }
      } else if (name.middle && name.middle.length) {
        let middle=name.middle.toLowerCase().replace(/[^a-z]/g,'');
        name_match[`${last}_$middle[0]`]=expert;
      } else {
        name_match[last]=expert;
      }
      return Object.values(name_match);
    }

    // get all name matches
    const name_match = {}
    const experts=[];
    for (var rel in relatedBy) {
      if (relatedBy[rel].inheres_in) {
        try {
          let expert = await expertModel.client_get(rel.inheres_in['@id']);
          expert=expertModel.get_expected_model_node(expert);
          if (name_match[expert]) {
            delete relatedBy[rel['@id']];
          }
        } catch(e) {
        }
      }
    }
    // finally remove relatedBy with names that match experts
    for (var rel in relatedBy) {
      if (! relatedBy[rel].inheres_in) {
        nameMatches(rel).forEach((nm) => {
          if (name_match[nm]) {
            delete relatedBy[rel];
            next;
          }
        });
      }
    }
    relatedBy.keys().forEach((key) => {
      if (name_match[key]) {
        delete relatedBy[key];
      }
    });
    // add to doc
    doc.relatedBy=Object.values(relatedBy);
    await this.update_or_create_main_node_doc(doc);

    const grant_snippet = this.snippet(doc);
    for (expert in experts) {
      try {
        await this.update_graph_node(doc['@id'], expertModel.snippet(expert));
        logger.info(`GrantModel.update() ${doc['@id']} <== ${expert['@id']}`);
      } catch(e) {
        logger.info(`GrantModel.update() ${doc['@id']} <XX ${expert['@id']}`);
      }
      try {
        expertModel.update_graph_node(expert['@id'], grant_snippet);
        logger.info(`GrantModel.update() ${doc['@id']} ==> ${expert['@id']}`);
      } catch(e) {
        logger.info(`GrantModel.update() ${doc['@id']} XX> ${expert['@id']}`);
      }
    }
  }
}
module.exports = GrantModel;
