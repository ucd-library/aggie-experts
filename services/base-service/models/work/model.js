// Can use this to get the fin configuration
const {logger } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

/**
 * @class WorkModel
 * @description Base class for Aggie Experts data models.
 */
class WorkModel extends BaseModel {

  static transformed_types = [ 'Work' ];

  static types = [
    "http://schema.library.ucdavis.edu/schema#Work"
  ];

  constructor(name='work') {
    super(name);
  }

  snippet(node) {
    let snip=super.snippet(node);
    return snip;
  }

  /**
   * @method promote_node_to_doc
   * @description Promotes some node fields to document fields
   * @param {Object} node
   * @returns {Object} : document
   **/
  promote_node_to_doc(node) {
    const doc = super.promote_node_to_doc(node);

    // quick hack to get the title
    doc.name = node.title;

    // Is this really needed?
//    ["title","issued","container-title","author","DOI","type"].forEach((key)=>{
//      if (node?.[key]) {
//        doc[key] = node[key];
//      }
//    });

    return doc;
  }


  /**
   * @method update
   * @description Update Elasticsearch with the given data.

     The current method matches the grants, version expecting authorships to be
     in the work itself and not as a seperate node
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
      existing = this.get_expected_model_node(existing);
      addRelatedBy(existing);
    } catch(e) {
      //logger.info(`WorkModel.update: ${root_node['@id']} not found`);
    }
    addRelatedBy(root_node);

    // foreach relatedBy, fetch the expert
    const expertModel=await this.get_model('expert');
    const experts=[];
    for (var rel in relatedBy) {
      let authorship = relatedBy[rel];
      if (authorship["is-visible"]==true) {
        for(let i=0; i<authorship.relates.length; i++) {
          let related=authorship.relates[i];
          if (related.match(/^expert/)) {
            let expert=await expertModel.client_get(related);
            expert=expertModel.get_expected_model_node(expert);
            experts.push(expert);
          }
        }
      }
    }
    const doc = this.promote_node_to_doc(root_node);
    // If there are any experts, then the work is visible
    if (experts.length) {
      root_node["is-visible"]=true;
      doc["is-visible"]=true;
    }
    await this.update_or_create_main_node_doc(doc);
    const work_snippet = this.snippet(root_node);
    for (var i in experts) {
      let expert = experts[i];
      try {
        await this.update_graph_node(doc['@id'], expertModel.snippet(expert));
        logger.info(`Work.update() ${doc['@id']} <== ${expert['@id']}`);
      } catch(e) {
        logger.info(`Work.update() ${doc['@id']} <XX ${expert['@id']}`);
      }
      try {
        expertModel.update_graph_node(expert['@id'], work_snippet);
        logger.info(`Work.update() ${doc['@id']} ==> ${expert['@id']}`);
      } catch(e) {
        logger.info(`Work.update() ${doc['@id']} XX> ${expert['@id']}`);
      }
    }
  }
}
module.exports = WorkModel;
