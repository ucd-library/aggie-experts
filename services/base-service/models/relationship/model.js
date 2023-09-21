// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const ExpertsModel = require('../experts/model.js');

/**
 * @class RelationshipModel
 * @description Base class for Aggie Experts data models.
 */
class RelationshipModel extends ExpertsModel {

  static types = [
    "http://schema.library.ucdavis.edu/schema#Relationship",
    "http://schema.library.ucdavis.edu/schema#Authorship",
    "http://vivoweb.org/ontology/core#Authorship",
    "http://vivoweb.org/ontology/core#Relationship"
  ];

  constructor(name='relationship') {
    super(name);
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */

  async update(jsonld) {
    console.log(`RelationshipModel.update(${jsonld['@id']})`);
    await this.update_or_create_main_node_doc(jsonld);

    const root_node= this.get_main_graph_node(jsonld);

    let have={};
    // Get the work and the Person via the Authorship.relates
    const personModel= await this.get_model('person');
    const workModel= await this.get_model('work');
    for(let i=0; i<root_node?.relates?.length || 0; i++) {
      let relates = root_node.relates[i];
      try {
        // Is this a Person?
        // console.log(`get ${relates}`);
        let related = await personModel.client_get(relates);
        // console.log(`got ${related}`);
        related=this.get_main_graph_node(related);
        // This part is removed when we split the indices
        let type = this.experts_node_type(related);
        if (type !== 'Person') {
          throw new Error(`RelationshipModel.update(${jsonld['@id']}) - ${relates} is not a Person`);
        }
        have['Person'] = {id:relates,node:related };
      } catch (e) {
        try {
          // Is this a Work?
          let related = await workModel.client_get(relates);
          related=this.get_main_graph_node(related);
          let type = this.experts_node_type(related);
          if (type !== 'Work') {
            throw new Error(`RelationshipModel.update(${jsonld['@id']}) - ${relates} is not a Work`);
          }
          have['Work'] = {id:relates,node:related };
        } catch(e) {
          console.log(`RelationshipModel.update(${jsonld['@id']}) - ${relates} is not a Person or Work`);
        }
      }
      if (have.Person && have.Work) {
        // Add Work as snippet to Person
        // console.log(root_node);
        if (root_node['is-visible'] === true || root_node['is-visible'] === 'true') {
          console.log(`${have.Person.id} <=> ${have.Work.id}`);
          {
            const node = {
              ...workModel.snippet(have.Work.node),
              ...this.snippet(root_node),
              '@type': 'Authored'
            };
            delete node.relates;
            // console.log(`${have.Person.id} Authored ${have.Work.id}`);
            await personModel.update_graph_node(have.Person.id,node,root_node['is-visible']);
          }
          {
            const node = {
              ...personModel.snippet(have.Person.node),
              ...this.snippet(root_node),
              '@type': 'Author'
            };
            delete node.relates;
            // console.log(`${have.Work.id} Author ${have.Person.id}`);
            await workModel.update_graph_node(have.Work.id,node,root_node['is-visible']);
          }
        } else {
          console.log(`${have.Person.id} X=X ${have.Work.id}`);
          await personModel.delete_graph_node(have.Person.id,root_node);
          await workModel.delete_graph_node(have.Work.id,root_node);
        }
      }
    }
  }
}
module.exports = RelationshipModel;