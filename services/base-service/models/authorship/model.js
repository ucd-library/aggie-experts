// Can use this to get the fin configuration
const {models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

const finApi = require('@ucd-lib/fin-api/lib/api.js');
const config = require('../config');

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
   * @method get_node_by_related_id
   * @description Get elasticsearch node by id
   * @param {Object} doc : elasticsearch doc
   * @param {String} id : node id
   * @returns {Object} : elasticsearch node
   **/
  get_node_by_related_id(doc,id) {
    const nodes = [];
    for(let i=0; i<doc['@graph'].length; i++) {
      if ( doc['@graph'][i]?.['relatedBy']?.['@id'] === id ) {
        nodes.push(doc['@graph'][i]);
      }
    }
    if (nodes.length === 0) {
      throw new Error(`Unable to find node with relatedBy{"@id"="${id}"}`);
    }
    if (nodes.length > 1) {
      throw new Error(`Found multiple nodes with relatedBy{"@id"="${id}"}`);
    }
    return nodes[0];
  }

  /**
   * @method patch
   * @description Patch an authorship file.
   * @param {Object} patch :  { "@id", "is-visible","is-favourite" "objectId" }
   * @param {String} expertId : Expert Id
   * @returns {Object} : document object
    **/
  async patch(patch, expertId) {
    let id = patch['@id'];
    let expert;
    let resp;

    logger.info(`Patching ${expertId} authorship:`,patch);
    if (patch.visible == null && patch.favourite == null) {
      return 400;
    }

    // Immediate Update Elasticsearch document
    const expertModel= await this.get_model('expert');
    let node

    try {
      expert = await expertModel.client_get(expertId);
      node = this.get_node_by_related_id(expert,id);
      let node_id = node['@id'].replace("ark:/87287/d7mh2m/publication/","");
      if (patch.objectId==null) {
        patch.objectId = node_id;
      }
    } catch(e) {
      console.error(e.message);
      logger.info(`relatedBy[{@id${id} not found in expert ${expertId}`);
      return 404
    };
    if (patch.visible != null) {
      node['relatedBy']['is-visible'] = patch.visible;
    }
    if (patch.favourite != null) {
      node['relatedBy']['is-favourite'] = patch.favourite;
    }
    //already a snippet node = workModel.snippet(have_part.Work.node);
    await expertModel.update_graph_node(expertId,node);

    // Update FCREPO
    let options = {
      path: expertId + '/' + id,
      content: `
        PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
        DELETE {
          ${patch.visible != null ? `${id} ucdlib:is-visible ?v .`:''}
          ${patch.favourite !=null ?`${id} ucdlib:is-favourite ?f .`:''}
        }
        INSERT {
          ${patch.visible != null ?`${id} ucdlib:is-visible ${patch.visible} .`:''}
          ${patch.favourite != null ?`${id} ucdlib:is-favourite ${patch.favourite} .`:''}
        } WHERE {
          ${id} ucdlib:is-visible ?v .
          OPTIONAL { ${id} ucdlib:is-favourite ?fav } .
        }
      `
    };
    resp = await finApi.patch(options);

    if (config.experts.cdl_propogate_changes) {
      const cdl_user = await expertModel._impersonate_cdl_user(expert);
      resp = await cdl_user.setLinkPrivacy({
        objectId: patch.objectId,
        privacy: patch.visible ? 'public' : 'internal'
      })
      logger.info({cdl_response:resp},`CDL propogate changes ${config.experts.cdl_propogate_changes}`);
    } else {
      logger.info({cdl_response:null},`XCDL propogate changes ${config.experts.cdl_propogate_changes}`);
    }
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

  /**
   * @method delete
   * @description Delete an authorship file
   * @param {String} id of work
   * @param {String} expertId : Expert Id
  **/
  async delete(id, expertId) {
    logger.info(`Deleting ${id}`);

    // Delete Elasticsearch document
    const expertModel = await this.get_model('expert');
    let node;
    let expert;
    let objectId;
    let resp;

    try {
      expert = await expertModel.client_get(expertId);
      node = this.get_node_by_related_id(expert, id);
      objectId = node['@id'].replace("ark:/87287/d7mh2m/publication/","");
    } catch(e) {
      console.error(e.message);
      logger.info(`relatedBy[{@id ${id} not found in expert ${expertId}`);
      return 404
    };

    await expertModel.delete_graph_node(expertId, node);

    // Delete from FCREPO
    let options = {
      path: expertId + '/' + id,
      permanent: true
    };

    await finApi.delete(options);

    if (config.experts.cdl_propogate_changes) {
      let linkId=id.replace("ark:/87287/d7mh2m/relationship/","");
      const cdl_user = await expertModel._impersonate_cdl_user(expert);
      logger.info({cdl_request:{linkId:id,objectId:objectId}},`CDL propogate changes ${config.experts.cdl_propogate_changes}`);
      resp = await cdl_user.reject({
        linkId: linkId,
        objectId: objectId
      })
      logger.info({cdl_response:resp},`CDL propogate changes ${config.experts.cdl_propogate_changes}`);
    } else {
      logger.info({cdl:null},`CDL propogate changes ${config.experts.cdl_propogate_changes}`);
    }

  }
}
module.exports = AuthorshipModel;
