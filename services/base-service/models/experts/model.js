// Can use this to get the fin configuration
const {config, models } = require('@ucd-lib/fin-service-utils');
const schema = require('./schema/minimal.json');
const FinEsNestedModel = require('../fin-es-nested-model');
const query_template = require('./template/default.json');

/**
 * @class ExpertsModel
 * @description Base class for Aggie Experts data models.
 */
class ExpertsModel extends FinEsNestedModel {

  // Experts Model never matches
  static types = [
//    "http://schema.library.ucdavis.edu/schema#Person",
//    "http://schema.library.ucdavis.edu/schema#Work",
//    "http://schema.library.ucdavis.edu/schema#Authorship",
//    "http://vivoweb.org/ontology/core#Authorship",
//    "http://vivoweb.org/ontology/core#Grant",
  ];

  constructor(name='experts') {

    super(name);
    this.schema = schema;  // Common schema for all experts data models
    this.transformService = "node";
    this.query_template = query_template;
  }

  /**
   * @method is
   * @description Determines if this model can handle the given file based on
   * it's type.
   */
  is(id,types,workflows) {
//    console.log('constructor', this.constructor, 'vs', types);
    if (typeof types === 'string') types = [types];
    types = types.filter(x => this.constructor.types.includes(x));
    if (types.length === 0) {
      console.log(`${this.constructor.name}.is: ${id} is not a valid type`);
      return false;
    }
    console.log(`${this.constructor.name}.is: ${types.join(",")} is a valid type`);
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
   * by elasticsearch.  Default is to return whole node.
   */
  snippet(node) {
    delete node['_'];
    return node;
  }

  // set the default query template
  async put_template() {
    const result = await this.client.putScript(this.query_template);
    console.log(`default query template: ${result}`);
    return result;
  }


  /**
   * @method get_model
   * @description returns a model for a given type
   */
  async get_model(model) {
    const method=model+'Model';
    if (!(method in this)) {
      this.method = (await models.get(model)).model;
//      console.log(`get_model: ${model} not found, loading...`);
    }
//    console.log(`get_model: ${model} found`,this.method);
    return this.method;
  }

  async update(jsonld) {
    throw new Error(`${this.constructor.name}.update(${jsonld['@id']}) not implemented`);
  }

  async remove(jsonld) {
    throw new Error(`${this.constructor.name}.delete(${jsonld['@id']}) not implemented`);
  }

}
module.exports = ExpertsModel;
