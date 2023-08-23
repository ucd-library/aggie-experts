// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const ExpertsModel = require('../experts/model.js');
const RelationshipModel = require('../relationship/model.js');
const PersonModel = require('../person/model.js');

/**
 * @class WorkModel
 * @description Base class for Aggie Experts data models.
 */
class WorkModel extends ExpertsModel {

  //  static Relationship = new RelationshipModel();
  static Relationship = null;
  static Person = null;
//  static Person = new PersonModel();
  static types = [
    "http://schema.library.ucdavis.edu/schema#Work"
  ];

  constructor(name='work') {
    super(name);

    Object.defineProperty(this, "Relationship", {
      writable: false, // This makes the property read-only
      enumerable: true,
      configurable: false // This prevents reconfiguration of the property
    });

    Object.defineProperty(this, "Person", {
      value: WorkModel.Person,
      writable: false, // This makes the property read-only
      enumerable: true,
      configurable: false // This prevents reconfiguration of the property
    });

  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */
  async update(jsonld) {
    console.log(`${this.constructor.name}.update(${jsonld['@id']})`);
    await this.update_or_create_main_node_doc(jsonld);
    const root_node= this.get_main_graph_node(jsonld);

    // Update all Authors with this work as well
    let authorships= await this.Relationship.esMatchNode({
      '@type': 'Authorship', 'relates': jsonld['@id'] });

    for (let i=0; i<authorships?.hits?.hits?.length || 0; i++) {
      let authorship = authorships.hits.hits[i]._source?.['@graph']?.[0] || {};
      //console.log(`authorship[${i}]: ${authorship['@id']}`);
      const authored={
        ...root_node,
        ...authorship,
        '@type': 'Authored',
      };
      delete authored.relates;
      let relates=authorship.relates.filter(x => x !== jsonld['@id']);
      if (relates.length != 1) {
        throw new Error(`Expected 1 relates, got ${relates.length}`);
      }
      for (let j=0;j<relates.length; j++) {
        console.log(`${this.constructor.name} add ${authored["@id"]} => ${relates[j]}`);
        try {
          let person=await this.Person.get(relates[j])
          person=this.get_main_graph_node(related['_source']);
          const author = {
            ...this.Person.snippet(person),
            ...authorship,
            '@type': 'Author'
          };
          delete author.relates;

          // Authored(work) is added to Person
          await this.Person.update_graph_node(relates[j],authored)

          // Author(person) is added to Work
          await this.update_graph_node(jsonld['@id'],author)
        } catch (e) {
          console.log(`${relates[j]} not found`);
        }
      }
    }
  }
}
module.exports = WorkModel;
