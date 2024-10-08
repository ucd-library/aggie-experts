const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
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

    const relatedBy = {};

    // combine relatedBy (ordered)
    function addRelatedBy(node) {
      if (node.relatedBy) {
        Array.isArray(node.relatedBy) || (node.relatedBy = [node.relatedBy]);
        node.relatedBy.forEach((rel) => {
          relatedBy[rel['@id']] = rel;
          });
      }
    }

    try {
      let existing = await this.client_get(root_node['@id']);
      existing=this.get_expected_model_node(existing);
      addRelatedBy(existing);
    } catch(e) {
    }
    addRelatedBy(root_node);

    // for each value in relatedBy, if it has .inheres_in, fetch expert
    function nameMatches(name) {
      const name_match={}
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

    const expertModel = await this.get_model('expert');
    // get all name matches
    const name_match = {}
    const experts=[];
    for (var rel in relatedBy) {
      let role=relatedBy[rel];
      if (role.inheres_in) {
        let id = role.inheres_in['@id'] || role.inheres_in;
//        try {
        let expert = await expertModel.client_get(role.inheres_in);
          expert=expertModel.get_expected_model_node(expert);
          experts.push(expert);
          if (expert?.contactInfo?.hasName) {
            console.log('name:', expert.contactInfo.hasName);
            nameMatches(expert?.contactInfo?.hasName).forEach((n) => {
              name_match[n]=expert;
            });
          }
//        } catch(e) {
//          logger.error(`GrantModel.update expert '${id}' not found`);
//        }
      }
    }
    // finally remove relatedBy with names that match experts
    for (var rel in relatedBy) {
      let role=relatedBy[rel];
      if (! role.inheres_in && role?.relates?.hasName) {
        console.log('other name:', role.hasName);
        nameMatches(rel.hasName).forEach((nm) => {
          if (name_match[nm]) {
            delete relatedBy[rel];
            next;
          }
        });
      }
    }
    root_node.relatedBy=Object.values(relatedBy);
    const doc = this.promote_node_to_doc(root_node);
    await this.update_or_create_main_node_doc(doc);

    const grant_snippet = this.snippet(root_node);
    for (var i in experts) {
      let expert = experts[i];
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
