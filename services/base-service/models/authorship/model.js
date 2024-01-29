// Can use this to get the fin configuration
const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

const finApi = require('@ucd-lib/fin-api/lib/api.js');

/**
 * @class AuthorshipModel
 * @description Base class for Aggie Experts data models.
 */
class AuthorshipModel extends BaseModel {

  static transformed_types = [ 'Authorship' ];
  static types = [
    "http://vivoweb.org/ontology/core#Authorship" ];

  constructor(name='authorship') {
    super(name);
  }

  /**
   * @method promote_node_to_doc
   * @description Promote the given node to a document. Return node components to be included in the document.
   * @param {Object} node :  node to promote
   * @returns {Object} : document object
   **/
  promote_node_to_doc(node) {
    const doc = {
      '@id': node['@id'],
      '@type': node['@type'],
      '@graph': [node]
    };
    return doc;
  }

  /**
   * @method patch
   * @description Patch an authorship file.
   * @param {Object} args :  { id: id to favourite, patch, expertId }
   * @returns {Object} : document object
    **/
  async patch(patch, expertId) {
    let id = patch['@id'];
    let doc;
    let resp;

    // TODO: Quinn #1 Update Elasticsearch document
    logger.info('Patching authorship:',patch);
    try {
      doc = await this.client_get(id);
      console.log(doc);
    } catch(e) {
      logger.info('Patching ${id} not found');
      return 404
    };
    if (! defined(visible)) {
      return 400;
    }
    doc['@graph'][0]['visible'] = visible;
    await this.update(doc);

    // Update FCREPO
    let visible=undefined;
    if (defined(patch['visible'])) {
      visible = patch['visible'];
    }
    let favourite=undefined;
    if (defined(patch['favourite'])) {
      favourite = patch['favourite'];
    }
    let options = {
      path: expertId + '/' + id,
      content: `
        @PREFIX experts: <http://experts.ucdavis.edu/> .
        @PREFIX ucdlib: <http://schema.library.ucdaivs.edu/schema#> .
        DELETE {
          ${defined(visible)?`experts:${id} ucdlib:is-visible ${!visible} .`}
          ${defined(favourite)?`experts:${id} ucdlib:is-favourite ${!favourite} .`}
        }
        INSERT {
          ${defined(visible)?`experts:${id} ucdlib:is-visible ${visible} .`}
          ${defined(favourite)?`experts:${id} ucdlib:is-favourite ${favourite} .`}
        } WHERE {}
      `
    };
    resp = await finApi.patch(options);

    // TODO: Quinn #3 Update CDL
    const expertModel= await this.get_model('expert');
    try {
      let expert = await expertModel.client_get(expertId);
      console.log(expert);
    } catch(e) {
      logger.info('patch:expert ${expertId} not found');
      return 503
    }
    // get CDL user id
    let root_node = await expertModel.get_root_node(expertId);
    console.log(root_node);
//    if (! this.elementsClient ) {
//      const { elementsClient } = await import('@ucd-lib/experts-api');
//      this.elementsClient = elementsClient;
//    }
//    let cdl_user = await this.elementsClient.impersonate(cdl_user_id,{instance: 'qa'})
//    let resp = await cdl_user.setLinkPrivacy({
//      objectId,
//      privacy: visible ? 'public' : 'internal'
//    })
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */

  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);
    const doc = this.promote_node_to_doc(root_node);
    logger.info(`AuthorshipModel.update(${doc['@id']})`);
    await this.update_or_create_main_node_doc(doc);

    const have_part={};
    // Get the work and the Expert via the Authorship.relates
    const expertModel= await this.get_model('expert');
    const workModel= await this.get_model('work');
    // The root_node is the Authorship node, pointers to Expert and Work (which is now another node)
    for(let i=0; i<root_node?.relates?.length || 0; i++) {
      let relates = root_node.relates[i];
      try {
        // Is this a Expert?
        let related = await expertModel.client_get(relates);
        let type = this.experts_node_type(related);
        if (type !== 'Expert') {
          throw new Error(`AuthorshipModel.update(${doc['@id']}) - ${relates} is not a Expert`);
        }
        have_part['Expert'] = {id:relates,node:related };
      } catch (e) {
        // Is this included Work?
        let related = workModel.get_expected_model_node(transformed);
        let type = this.experts_node_type(related);
        if (relates !== related['@id']) {
          throw new Error(`AuthorshipModel.update(${relates} not included in doc`);
        }
        if (type !== 'Work') {
          throw new Error(`AuthorshipModel.update(${relates} is not a Work`);
        }
        have_part['Work'] = {id:relates,node:related };
      }
      if (have_part.Expert && have_part.Work) {
        // Add Work as snippet to Expert
        logger.info(`${have_part.Expert.id} ==> ${have_part.Work.id}`);
        {
          const node = workModel.snippet(have_part.Work.node);
          await expertModel.update_graph_node(have_part.Expert.id,node);
        }
      } else {
        if (have_part.Expert) {
          logger.info(`${have_part.Expert.id} =>? ?Work?`);
        } else {
          if (have_part.Work) {
            logger.info(`?Expert? ?=> ${have_part.Work.id}`);
          } else {
            logger.info(`?Expert? ?=? ?Work?`);
          }
        }
      }
    }
  }
}
module.exports = AuthorshipModel;
