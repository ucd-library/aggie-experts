// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

/**
 * @class AuthorshipModel
 * @description Base class for Aggie Experts data models.
 */
class AuthorshipModel extends BaseModel {

  static types = [
    "http://schema.library.ucdavis.edu/schema#Authorship",
    "http://vivoweb.org/ontology/core#Authorship",
    "http://vivoweb.org/ontology/core#Relationship"
  ];

  constructor(name='relationship') {
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
   * @method update
   * @description Update Elasticsearch with the given data.
   */

  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);
    const doc = this.promote_node_to_doc(root_node);
    logger.info(`AuthorshipModel.update(${doc['@id']})`);
    await this.update_or_create_main_node_doc(doc);

    const have_part={};
    // Get the work and the Person via the Authorship.relates
    const personModel= await this.get_model('person');
    const workModel= await this.get_model('work');
    // The root_node is the Authorship node, pointers to Person and Work (which is now another node)
    for(let i=0; i<root_node?.relates?.length || 0; i++) {
      let relates = root_node.relates[i];
      try {
        // Is this a Person?
        let related = await personModel.client_get(relates);
        let type = this.experts_node_type(related);
        if (type !== 'Person') {
          throw new Error(`AuthorshipModel.update(${doc['@id']}) - ${relates} is not a Person`);
        }
        have_part['Person'] = {id:relates,node:related };
      } catch (e) {
        try {
          // Is this included Work?
          let related = workModel.get_expected_model_node(transformed);
          let type = this.experts_node_type(related);
          if (relates !== related[0])
            throw new Error(`AuthorshipModel.update(${relates} not included in doc`);
          if (type !== 'Work') {
            throw new Error(`AuthorshipModel.update(${relates} is not a Work`);
          }
          have_part['Work'] = {id:relates,node:related };
        } catch(e) {
          logger.warn(`AuthorshipModel.update(${relates} is not a Person or Work`);
        }
      }
      if (have_part.Person && have_part.Work) {
        // Add Work as snippet to Person
        // console.log(root_node);
        if (root_node['is-visible'] === true || root_node['is-visible'] === 'true') {
          logger.info(`${have_part.Person.id} ==> ${have_part.Work.id}`);
          {
            const node = {
              ...workModel.snippet(have_part.Work.node),
              ...this.snippet(root_node),
              '@type': 'Authored',
            };
            delete node.relates;
            // console.log(`${have_part.Person.id} Authored ${have_part.Work.id}`);
            await personModel.update_graph_node(have_part.Person.id,node,root_node['is-visible']);
          }
        } else {
          logger.info(`${have_part.Person.id} !=> ${have_part.Work.id}`);
          await personModel.delete_graph_node(have_part.Person.id,root_node);
        }
      }
    }
  }
}
module.exports = AuthorshipModel;
