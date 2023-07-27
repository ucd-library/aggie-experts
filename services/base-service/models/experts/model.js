const {dataModels} = require('@ucd-lib/fin-service-utils');
const schema = require('./vivo.json');
const {FinEsDataModel} = dataModels;

/**
 * @class ExpertsModel
 * @description Base class for Aggie Experts data models.
 */
class ExpertsModel extends FinEsDataModel {

  static Types = ['Person','Work','Grant','Authorship'];

  static types = [
    "http://schema.library.ucdavis.edu/schema#Person",
    "http://schema.library.ucdavis.edu/schema#Work",
    "http://schema.library.ucdavis.edu/schema#Authorship",
    "http://vivoweb.org/ontology/core#Authorship",
    "http://vivoweb.org/ontology/core#Grant",
  ];

  constructor() {
    super('experts');
    this.schema = schema;  // Common schema for all experts data models
    this.transformService = "node";
    // Every model has the same index
    this.readIndexAlias = 'experts-read';
    this.writeIndexAlias = 'experts-write';
    // Elasticsearch client is in super class as this.client

  }

  is(id,types,workflows) {
    if (typeof types === 'string') types = [types];
    console.log('types',types);
    types = types.filter(x => ExpertsModel.types.includes(x));
    if (types.length === 0) {
      console.log(`ExpertsModel.is: ${id} is not a valid type`);
      return false;
    }
    console.log(`ExpertsModel.is: ${types.join(",")} is a valid type`);
    return true
  }

  async esSearchGraph(query,index) {
    //      const options={debug:true,admin:true};
    const options={};
    return this.esSearch(
        {
          query: {
            nested:{
              path: "@graph",
              query: query
            }
          }
        });

  }

  // The path where you would expect to find a particular id.  It only localizes
  // experts.ucdaivs.edu ids, otherwise, they are unchanged (arks:,dois: etc)
  expected_path(id) {
    return id.replace('http://experts.ucdavis.edu/','');
  }

  // The index to the node in the graph that corresponds to the path_id, as
  // shown in the jsonld["@id"] location.  This searches for a graph with a
  // matching identifier.
  get_main_graph_record_index(jsonld) {
    const local_path = this.expected_path(jsonld['@id']);
    let main_graph_record_index = undefined;
    let types = []
    console.log(`jsonld ${jsonld['@id']} has ${jsonld['@graph'].length} records`);
    for(let i=0; i<jsonld['@graph'].length; i++) {
      let node = jsonld['@graph'][i];
      console.log(i,"->",node['@id']);
      if (local_path===node['@id']) {
        console.log("Found main record index",i);
        main_graph_record_index = i;
        let types = this.get_node_types(node);
        if (types.length > 0) {
          break;
        }
      }
    }
    return main_graph_record_index;
  }

  get_node_types(node) {
    let types;
    // Look for valid type in index
    types=node['@type'];
    if (typeof types === 'string') types = [types];
    types = types.filter(x => ExpertsModel.Types.includes(x));
    return types;
  }

  get(id,opts) {
    id=id.replace(/^\//,'');
    console.log(`ExpertsModel.get(${id})`);
    console.log(`opts`,opts);
    console.log(super.get);
    return super.get(id,opts);
  }

  async update(jsonld, index) {

    console.log(`ExpertsModel.update(${jsonld['@id']})`);

    // Update the main graph ~/fin/services/fin/node-utils/lib/data-models/elastic-search/
    await super.update(jsonld, index);

    const main_record_index= this.get_main_graph_record_index(jsonld);
    const node=jsonld['@graph'][main_record_index];
    const types = this.get_node_types(node);

    if (types.includes('Work')) {
      // get all authorships for work (by work id)
      const work=jsonld['@graph'][main_record_index];

      let authorships= await this.esSearchGraph(
        { bool: {
          must: [
            { term: { '@graph.@type': { value:'Authorship' } } },
            { term: { '@graph.relates': { value: local_path } } }
          ]
        } },index);
      if (authorships.hits && authorships.hits.hits) {
        //console.log('authorships length',authorships.hits.hits.length);
        for (let i=0; i<authorships.hits.hits.length; i++) {
          let authorship = authorships.hits.hits[i]._source;
          let node={};
          ["DOI","abstract","container-title","publisher","title","type","url","hasPublicationVenue"].forEach((key) => {
            if (work[key]) {
              node[key]=work[key];
            }
          });
          node={
            ...node,
            ...authorship['@graph'][0]
          };
          let relates=node.relates.filter(x => x !== local_path);
          console.log('relates',relates);
          delete node.relates;
          console.log('Adding node',JSON.stringify(node,null,2));
          for (let j=0;j<relates.length; j++) {
            console.log('to work (',j,')',relates[j]);
            await this.update({"@id":relates[j],
                               "@graph": node},index);
            console.log('updated')
          }
        }
      }
    }
    // Update a Person record
    if (types.includes('Person')) {
      // Need to get the important subset of the person
      let best=jsonld['@graph'][main_record_index].contactInfo.sort((a,b) => {
        (a['vivo:rank'] || 100) - (b['vivo:rank'] || 100)})[0];
      ['hasOrganizationalUnit','hasTitle','vcard:hasURL','vivo:rank'].forEach(x => delete best[x]);
      // get all authorships for person (by person id)
      let authorships= await this.esSearchGraph(
        { bool: {
          must: [
            { term: { '@graph.@type': { value:'Authorship' } } },
            { term: { '@graph.relates': { value: local_path } } }
          ]
        } },index);
      console.log('authorships',authorships);
      if (authorships.hits && authorships.hits.hits) {
        //console.log('authorships length',authorships.hits.hits.length);
        for (let i=0; i<authorships.hits.hits.length; i++) {
          let authorship = authorships.hits.hits[i]._source;
          // console.log('authorship',authorship);
          let node={
            "identifier":jsonld['@graph'][main_record_index]['identifier'],
            "orcidId": jsonld['@graph'][main_record_index]['orcidId'],
            "name": jsonld['@graph'][main_record_index]['name'],
            "contactInfo": [ best ],
            ...authorship['@graph'][0]
          };
          let relates=node.relates.filter(x => x !== local_path);
          console.log('relates',relates);
          delete node.relates;
          console.log('Adding node',JSON.stringify(node,null,2));
          for (let j=0;j<relates.length; j++) {
            console.log('to work (',j,')',relates[j]);
            await this.update({"@id":relates[j],
                               "@graph": node},index);
            console.log('updated')
          }
        }
      }
    }
    if (types.includes('Grant')) {
      console.log('Grantify');
// grant update
// update grant
// fetch persons by grant connections
// persons.forEach(person => {
// add grant to person / person to grant if exists
// })
    }
    if (types.includes('Authorship')) {
      console.log('Authorshipify');
      console.log(jsonld['@graph'][main_record_index]);
// authorship update
// update authorship
// fetch person by authorship.person / fetch work by authorship.work
// if person exists, update person with authorship / citation
// if work exists, update work with authorship / citation
// })
    }
  }
}

// This exports the class, not an instance of the class, unlike the other models
//module.exports = {
//  ExpertsModel: ExpertsModel
//};
module.exports = new ExpertsModel();
