// Can use this to get the fin configuration
const {config, models } = require('@ucd-lib/fin-service-utils');
const schema = require('./schema/minimal.json');
const FinEsNestedModel = require('../fin-es-nested-model');

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

  /** vvvv TEMPLATE SEARCH vvvv **/
  /**
   * @method render
   * @description return an ES ready nested search using a template
   * @returns string
   */
  async render(opts) {
    params = {
      size:10,
      from:0,
      ...opts.params
    }
    // convert page to from if from is not set
    if (params.from === 0 && params.page > 0) {
      params.from = (params.page - 1) * params.size;
    }

    const options = {
      id: (opts.id)?opts.id:"default",
      params
    }
    // Check if template exists, install if not
    try {
      const result = await this.client.getScript({id:options.id});
//      console.log(`render: template ${options.id} exists`);
    } catch (err) {
      const template = require(`./template/${options.id}.json`);
      const result = await this.client.putScript(template);
    }

    const template = await client.renderSearchTemplate(options);
    return template;
  }

  async search(params) {
    const q = render(params);
    let result = await this.esSearch(q, {admin: options.admin}, this.readIndexAlias);
    // Later, we will should move this to real templates
    const q = this.query_template.script.source.query;
    // This is not flexible
    q.from=opts.from;
    q.size=opts.size;
    q.nested.query["multi-match"].query=opts.text;

    await res=this.client.search(options);
    return result;
  }
  /** ^^^^TEMPLATE SEARCH^^^^ **/



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
