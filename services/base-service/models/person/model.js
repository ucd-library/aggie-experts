// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const ExpertsModel = require('../experts/model.js');

/**
 * @class PersonModel
 * @description Base class for Aggie Experts data models.
 */
class PersonModel extends ExpertsModel {

//  static Relationship = new RelationshipModel();
//  static Work = new WorkModel();

  static types = [
    "http://schema.library.ucdavis.edu/schema#Person",
  ];

  constructor(name='person') {
    super(name);
  }

  /**
   * @method snippet
   * @description returns searchable snippet of a node
   * by elasticsearch.
   */
  snippet(node) {
    const snippet= ["identifier","orcidId","name","contactInfo"];

    // Get only best contact info
    if (node.contactInfo) {
      let best=node.contactInfo.sort((a,b) => {
        (a['rank'] || 100) - (b['rank'] || 100)})[0];
      ['hasOrganizationalUnit','hasTitle','hasURL','rank'].forEach(x => delete best[x]);
      node.contactInfo = [best];
    }

    // Now select some of the fields.
    let s = {};
    snippet.forEach((key) => {
      if (node[key]) {
        s[key] = node[key];
      }
    });
    return s;
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

    // Update all Works with this Person as well
    let authorships= await relationshipModel.esMatchNode({ 'relates': jsonld['@id'] });

    for (let i=0; i<authorships?.hits?.hits?.length || 0; i++) {
      let authorship = authorships.hits.hits[i]._source?.['@graph']?.[0] || {};
      console.log(`authorship[${i}]: ${authorship['@id']}`);

      const author={
        ...this.snippet(root_node),
        ...authorship,
        '@type': 'Author',
      };
      delete author.relates;
      let relates=authorship.relates.filter(x => x !== jsonld['@id']);
      if (relates.length != 1) {
        throw new Error(`Expected 1 relates, got ${relates.length}`);
      }

      const workModel=await this.get_model('work');

      for (let j=0;j<relates.length; j++) {
        try {
          let work=await workModel.get(relates[j])
          work=this.get_main_graph_node(work['_source']);
          const authored = {
            ...workModel.snippet(work),
            ...authorship,
            '@type': 'Authored'
          };
          delete authored.relates;

          if (authorship['is-visible']) {
            console.log(`${jsonld["@id"]} <=> ${relates[j]}`);
          } else {
            console.log(`${jsonld["@id"]} X=X ${relates[j]}`);
          }
          await workModel.update_graph_node(relates[j],author,authorship['is-visible']);
          // Authored (work) is added to Person
          await this.update_graph_node(jsonld['@id'],authored,authorship['is-visible']);
        } catch (e) {
          console.log(`${relates[j]} not found`);
        }
      }
    }
  }
}
module.exports = PersonModel;
