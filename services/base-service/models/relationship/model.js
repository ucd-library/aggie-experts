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

    if (root_node.visible === false) {
      console.log(`RelationshipModel.update(${jsonld['@id']}) - not visible`);
      return;
    }

    let have={};
    // Get the work and the Person via the Authorship.relates
    const personModel= await this.get_model('person');
    const workModel= await this.get_model('work');
    for(let i=0; i<root_node?.relates?.length || 0; i++) {
      let relates = root_node.relates[i];
      try {
        // Is this a Person?
        // console.log(`get ${relates}`);
        let related = await personModel.get(relates);
        // console.log(`got ${related}`);
        related=this.get_main_graph_node(related['_source']);
        // This part is removed when we split the indices
        let type = this.experts_node_type(related);
        if (type !== 'Person') {
          throw new Error(`RelationshipModel.update(${jsonld['@id']}) - ${relates} is not a Person`);
        }
        have['Person'] = {id:relates,node:related };
      } catch (e) {
        try {
          // Is this a Work?
          let related = await workModel.get(relates);
          related=this.get_main_graph_node(related['_source']);
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
        console.log(`${have.Person.id} <=> ${have.Work.id}`);
        // Add Work as snippet to Person
        {
          const node = {
            ...this.snippet(have.Work.node),
            ...root_node,
            '@type': 'Authored'
          };
          delete node.relates;
          // console.log(`${have.Person.id} Authored ${have.Work.id}`);
          const response = await personModel.update_graph_node(have.Person.id,node)
        }
        {
          const node = {
            ...this.snippet(have.Person.node),
            ...root_node,
            '@type': 'Author'
          };
          delete node.relates;
          // console.log(`${have.Work.id} Author ${have.Person.id}`);
          const response = await workModel.update_graph_node(have.Work.id,node)
        }
      }
    }
  }
}
module.exports = RelationshipModel;
