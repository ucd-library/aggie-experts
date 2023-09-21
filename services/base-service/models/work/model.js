// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const ExpertsModel = require('../experts/model.js');

/**
 * @class WorkModel
 * @description Base class for Aggie Experts data models.
 */
class WorkModel extends ExpertsModel {

  static types = [
    "http://schema.library.ucdavis.edu/schema#Work"
  ];

  constructor(name='work') {
    super(name);
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */
  async update(jsonld) {
    console.log(`${this.constructor.name}.update(${jsonld['@id']})`);
    await this.update_or_create_main_node_doc(jsonld);
    const root_node= this.get_main_graph_node(jsonld);

    const relationshipModel=await this.get_model('relationship');
    const personModel=await this.get_model('person');
    // Update all Authors with this work as well
    let authorships= await relationshipModel.esMatchNode({
      '@type': 'Authorship', 'relates': jsonld['@id'] });

    for (let i=0; i<authorships?.hits?.hits?.length || 0; i++) {
      let authorship = authorships.hits.hits[i]._source?.['@graph']?.[0] || {};
      //console.log(`authorship[${i}]: ${authorship['@id']}`);
      const authored={
        ...this.snippet(root_node),
        ...relationshipModel.snippet(authorship),
        '@type': 'Authored',
      };
      delete authored.relates;
      let relates=authorship.relates.filter(x => x !== jsonld['@id']);
      if (relates.length != 1) {
        throw new Error(`Expected 1 relates, got ${relates.length}`);
      }
      for (let j=0;j<relates.length; j++) {
//        try {
          let person=await personModel.client_get(relates[j])
          person=this.get_main_graph_node(person);
          const author = {
            ...personModel.snippet(person),
            ...relationshipModel.snippet(authorship),
            '@type': 'Author'
          };
          delete author.relates;

          if (authorship['is-visible']) {
            console.log(`${jsonld["@id"]} <=> ${relates[j]}`);
          } else {
            console.log(`${jsonld["@id"]} X=X ${relates[j]}`);
          }

          // Authored(work) is added to Person
          await personModel.update_graph_node(relates[j],authored,authorship['is-visible']);
          // Author(person) is added to Work
          await this.update_graph_node(jsonld['@id'],author,authorship['is-visible']);
//        } catch (e) {
//          console.log(`${relates[j]} not found`);
//        }
      }
    }
  }
}
module.exports = WorkModel;