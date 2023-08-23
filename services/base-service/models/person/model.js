// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const ExpertsModel = require('../experts/model.js');
//const RelationshipModel = require('../relationship/model.js');
//const WorkModel = require('../work/model.js');

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

//     Object.defineProperty(this, "Relationship", {
// //      value: new RelationshipModel(),
//       writable: false, // This makes the property read-only
//       enumerable: true,
//       configurable: false // This prevents reconfiguration of the property
//     });

//     Object.defineProperty(this, "Work", {
// //      value: new WorkModel(),
//       writable: false, // This makes the property read-only
//       enumerable: true,
//       configurable: false // This prevents reconfiguration of the property
//     });

  }

  /**
   * @method snippet
   * @description returns searchable snippet of a node
   * by elasticsearch.
   */
  snippet(node) {
    const snippit= ["identifier","orcidId","name","contactInfo"];

    // Get only best contact info
    if (node.contactInfo) {
      let best=node.contactInfo.sort((a,b) => {
        (a['vivo:rank'] || 100) - (b['vivo:rank'] || 100)})[0];
      ['hasOrganizationalUnit','hasTitle','vcard:hasURL','vivo:rank'].forEach(x => delete best[x]);
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

    // Update all Works with this Person as well
    let authorships= await this.Relationship.esMatchNode({
      '@type': 'Authorship', 'relates': jsonld['@id'] });

    for (let i=0; i<authorships?.hits?.hits?.length || 0; i++) {
      let authorship = authorships.hits.hits[i]._source?.['@graph']?.[0] || {};
      //console.log(`authorship[${i}]: ${authorship['@id']}`);
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
      for (let j=0;j<relates.length; j++) {
        console.log(`${this.constructor.name} add ${author["@id"]} => ${relates[j]}`);
        try {
          let work=await this.Work.get(relates[j])
          work=this.get_main_graph_node(work['_source']);
          const authored = {
            ...this.Work.snippet(work),
            ...authorship,
            '@type': 'Authored'
          };
          delete authored.relates;

          // Author(person) is added to Work
          await this.Work.update_graph_node(relates[j],author);

          // Authored (work) is added to Person
          await this.update_graph_node(jsonld['@id'],authored);
        } catch (e) {
          console.log(`${relates[j]} not found`);
        }
      }
    }
  }
}
module.exports = PersonModel;
