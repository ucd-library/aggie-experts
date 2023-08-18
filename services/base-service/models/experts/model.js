// Can use this to get the fin configuration
const {config} = require('@ucd-lib/fin-service-utils');
const schema = require('./vivo.json');
const FinEsNestedModel = require('./fin-es-nested-model');

/**
 * @class ExpertsModel
 * @description Base class for Aggie Experts data models.
 */
class ExpertsModel extends FinEsNestedModel {

  static types = [
    "http://schema.library.ucdavis.edu/schema#Person",
    "http://schema.library.ucdavis.edu/schema#Work",
    "http://schema.library.ucdavis.edu/schema#Authorship",
    "http://vivoweb.org/ontology/core#Authorship",
    "http://vivoweb.org/ontology/core#Grant",
  ];

  constructor(name='experts') {
    super(name);
    this.schema = schema;  // Common schema for all experts data models
    this.transformService = "node";

    this.readIndexAlias = 'experts-read';
    this.writeIndexAlias = 'experts-write';

  }

  /**
   * @method is
   * @description Determines if this model can handle the given file based on
   * it's type.
   */
  is(id,types,workflows) {
    if (typeof types === 'string') types = [types];
    types = types.filter(x => this.constructor.types.includes(x));
    if (types.length === 0) {
//      console.log(`ExpertsModel.is: ${id} is not a valid type`);
      return false;
    }
//    console.log(`ExpertsModel.is: ${types.join(",")} is a valid type`);
    return true
  }

  /**
   * @method experts_node_type
   * @description Get the experts node type for the given type
   * @param {String} node
   */
  experts_node_type(node) {
    const Types = ['Person','Work','Grant','Relationship','Authorship'];
    let types;
    // Look for valid type in index
    types=node['@type'];
    // console.log(`experts_node_type: ${types}`);
    if (typeof types === 'string') types = [types];
    types = types.filter(x => Types.includes(x));
    if (types.length > 1)
      throw new Error(`update: ${jsonld['@id']} has multiple types: ${types.join(",")}`);
    return types?.[0];
  }

  /**
   * @method snippet
   * @description returns searchable snippet of a node
   * by elasticsearch.
   */
  snippet(node) {
    const type = this.experts_node_type(node);
    const snippet = {
      'Work': ["DOI","abstract","container-title","publisher",
               "title","type","url","hasPublicationVenue"],
      'Person': ["identifier","orcidId","name","contactInfo"]
    };

    // If Person, only add best contactInfo
    if (type === 'Person') {
      if (node.contactInfo) {
        let best=node.contactInfo.sort((a,b) => {
          (a['vivo:rank'] || 100) - (b['vivo:rank'] || 100)})[0];
        ['hasOrganizationalUnit','hasTitle','vcard:hasURL','vivo:rank'].forEach(x => delete best[x]);
        node.contactInfo = [best];
      }
    }

    // Now select some of the fields.
    let s = {};
    snippet[type].forEach((key) => {
      if (node[key]) {
        s[key] = node[key];
      }
    });
    return s;
  }

  async update(jsonld) {
    console.log(`ExpertsModel.update(${jsonld['@id']})`);
    await this.update_or_create_main_node_doc(jsonld);

    const root_node= this.get_main_graph_node(jsonld);
    const type = this.experts_node_type(root_node);
    // This is the '@type' for the new snippet on a main record
    const snip_type = {'Work':'Authored',
                       'Person':'Author'};

    if (type === 'Person' || type === 'Work') {
      // Add this as a snippet to any related main nodes
      let authorships= await this.esMatchNode({
        '@type': 'Authorship', 'relates': jsonld['@id'] });

      // console.log(`ExpertsModel.update authorships`,authorships);

      const snip= this.snippet(root_node);
      for (let i=0; i<authorships?.hits?.hits?.length || 0; i++) {
        let authorship = authorships.hits.hits[i]._source?.['@graph']?.[0] || {};
        //console.log(`authorship[${i}]: ${authorship['@id']}`);
        const node={
          ...snip,
          ...authorship,
          '@type': snip_type[type]
        };
        delete node.relates;
        let relates=authorship.relates.filter(x => x !== jsonld['@id']);
        // There should be just one relates left
        for (let j=0;j<relates.length; j++) {
          console.log(`Adding ${node["@id"]} <=> ${relates[j]}`);
          try {
            let related=await this.get(relates[j])
            related=this.get_main_graph_node(related['_source']);
            const related_snip=this.snippet(related);
            const related_node= {
              ...related_snip,
              ...authorship,
              '@type': snip_type[this.experts_node_type(related)]
            };
            delete related_snip.relates;

            // Add the new snippet to the related node
            await this.update_graph_node(relates[j],node)

            // We need to add the related snippet of this back to our root node as well
            await this.update_graph_node(jsonld['@id'],related_node);
          } catch (e) {
            console.log(`${relates[j]} not found`);
          }
        }
      }
    }
    // Remove Later
    else if (type === 'Authorship') {
      let have={};
      // Get the work and the Person via the Authorship.relates
      for(let i=0; i<root_node?.relates?.length || 0; i++) {
        let relates = root_node.relates[i];
        try {
          // console.log(`ExpertsModel.update: ${relates}`);
          let related = await this.get(relates);
          related=this.get_main_graph_node(related['_source']);
          let type = this.experts_node_type(related);
          if (type === 'Person' || type === 'Work') {
            have[type] = { id:relates, node:related };
          }
          // console.log('ExpertsModel.have:',have);
        } catch (e) {
          console.log(`Authorship: ${relates} is not Person or Work`);
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
    } else if (type === 'Grant') {
      console.log('Grantify');
// fetch persons by grant connections
// persons.forEach(person => {
// add grant to person / person to grant if exists
// })
      console.log(root_node);
    } else {
      console.log(`ExpertsModel.update: ${jsonld['@id']} has unknown type: ${type}`);
    }
  }
}
module.exports = new ExpertsModel();
