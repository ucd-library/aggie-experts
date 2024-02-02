// Can use this to get the fin configuration
const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
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
    const doc = {
      "@id": node['@id'],
      "@graph": [node]
    };

    doc["@type"] = "Work";
    ["name","title","issued","container-title","author","DOI","type"].forEach((key)=>{
      if (node?.[key]) {
        doc[key] = node[key];
      }
    });

    return doc;
  }


  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */
  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);
    const doc = this.promote_node_to_doc(root_node);
    logger.info(`${this.constructor.name}.update(${doc['@id']})`);

    const authorshipModel=await this.get_model('authorship');
    const expertModel=await this.get_model('expert');
    // Update all Authors with this work as well
    let authorship = authorshipModel.get_expected_model_node(transformed);

    let relates=authorship.relates.filter(x => x !== doc['@id']);

    if (relates.length != 1) {
      // console.log("ERROR: doc['@id']="+doc['@id']+" relates="+JSON.stringify(relates));
      throw new Error(`Expected 1 relates, got ${relates.length}`);
    }
    const expert_id=relates[0];
    let expert=await expertModel.client_get(expert_id);
    expert=expertModel.get_expected_model_node(expert);
    const author = {
      ...expertModel.snippet(expert),
      ...authorshipModel.snippet(authorship),
      '@type': 'Author'
    };
    delete author.relates;
    delete author['@id'];
    // Author(expert) is added/delete to Work
    await this.update_or_create_main_node_doc(doc);
    await this.update_graph_node(doc['@id'],author);

    // Now determine visibility of the work itself
    try {
      let work=await this.client_get(doc['@id']);
      const work_node=this.get_expected_model_node(work);
      work_node["is-visible"]=false;
      const authors=this.get_nodes_by_type(work,'Author');
      for (let i=0; i<authors.length; i++) {
        if (authors[i]['is-visible']) {
          work_node["is-visible"]=true;
          break;
        }
      }
    } catch (e) {
      logger.info(`${doc["@id"]} visibility error`);
     }
  }
}
module.exports = WorkModel;
