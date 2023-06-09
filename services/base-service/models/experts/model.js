const {dataModels} = require('@ucd-lib/fin-service-utils');
const schema = require('./vivo.json');
const {FinEsDataModel} = dataModels;

/**
 * @class ExpertsModel
 * @description Base class for Aggie Experts data models.
 */
class ExpertsModel extends FinEsDataModel {

  static types = [
//    "http://experts.ucdavis.edu/schema#Person",
//    "http://experts.ucdavis.edu/schema#Work",
//    "http://experts.ucdavis.edu/schema#Authorship",
    "http://schema.library.ucdavis.edu/schema#Person",
    "http://schema.library.ucdavis.edu/schema#Work",
    "http://schema.library.ucdavis.edu/schema#Authorship",
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
    types = types.filter(x => ExpertsModel.types.includes(x));
    if (types.length === 0) {
      console.log(`ExpertsModel.is: ${id} is not a valid type`);
      return false;
    }
    console.log(`ExpertsModel.is: ${types.join(",")} is a valid type`);
    return true
  }

  async update(jsonld, index) {
    await super.update(jsonld, index);
}
// work update
// update work,
// get all authorships for work (by work id)
// authorshsips.forEach(authorship => {
// fetch person by authorship.person
// if person exists, update person with authorship / citation
// update citation with authorship / person
// })

// person update
// update person
// get all authorships for person (by person id)
// authorshsips.forEach(authorship => {
// fetch work by authorship.work
// if work exists, update work with authorship / citation in person and work
// })

// authorship update
// update authorship
// fetch person by authorship.person / fetch work by authorship.work
// if person exists, update person with authorship / citation
// if work exists, update work with authorship / citation
// })

// grant update
// update grant
// fetch persons by grant connections
// persons.forEach(person => {
// add grant to person / person to grant if exists
// })

}
// This exports the class, not an instance of the class, unlike the other models
//module.exports = {
//  ExpertsModel: ExpertsModel
//};
module.exports = new ExpertsModel();
