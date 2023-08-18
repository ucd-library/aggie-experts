// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const ExpertsModel = require('../experts/model.js');
// These get split later

/**
 * @class RelationshipModel
 * @description Base class for Aggie Experts data models.
 */
class RelationshipModel extends ExpertsModel {

  // Replace w/ Person's Experts, etc.
  const Experts = new ExpertsModel();

  static types = [
    "http://schema.library.ucdavis.edu/schema#Relationship",
    "http://schema.library.ucdavis.edu/schema#Authorship",
    "http://vivoweb.org/ontology/core#Authorship",
    "http://vivoweb.org/ontology/core#Relationship"
  ];

  constructor(name='relationship') {
    super('relationship');
//    this.schema = schema;  // Common schema for all experts data models
//    this.transformService = "node";
    // Every model has the same index
    this.Person = RelantionshipModel.Experts;
    this.Work = RelantionshipModel.Experts;
    this.readIndexAlias = 'experts-read-relationship';
    this.writeIndexAlias = 'experts-write-relationship';

  }

  /**
   * @method is
   * @description Determines if this model can handle the given file based on
   * it's type.
   */
  is(id,types,workflows) {
    if (typeof types === 'string') types = [types];
    types = types.filter(x => this.constructer.types.includes(x));
    if (types.length === 0) {
      console.log(`RT ${this.constructor.name}.is: ${id} is not a valid type`);
      return false;
    }
    console.log(`RT ${this.constuctor.name}.is: ${types.join(",")} is a valid type`);
    return true
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
    for(let i=0; i<root_node?.relates?.length || 0; i++) {
      let relates = root_node.relates[i];
      try {
        // Is this a Person?
        let related = await RelationshipModel.Person.get(relates);
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
          let related = await RelationshipModel.Work.get(relates);
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
          const response = await this.update_graph_node(have.Person.id,node)
        }
        {
          const node = {
            ...this.snippet(have.Person.node),
            ...root_node,
            '@type': 'Author'
          };
          delete node.relates;
          // console.log(`${have.Work.id} Author ${have.Person.id}`);
          const response = await this.update_graph_node(have.Work.id,node)
        }
      }
    }
  }
}
module.exports = new RelationshipModel();
