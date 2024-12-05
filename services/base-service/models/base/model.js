// Can use this to get the fin configuration
const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const {FinEsDataModel} = dataModels;
const schema = require('./schema/minimal.json');
const settings = require('./schema/settings.json');
const ingest_pipeline = require('./schema/aggie-experts-pipeline.json');

// await this.verify_ingest_pipeline('aggie-experts-pipeline', ingest_pipeline);

/**
 * @class BaseModel
 * @description Base class for Aggie Experts data models.  This class provides
 methods for updating an Elasticsearch document model that uses nested indexes
 for nodes in the the @graph space.  It's currently a wrapper around the
 FinEsDataModel, ~/fin/services/fin/node-utils/lib/data-models/elastic-search/,
 class.  But, I'm not sure if we'll keep it that way.
 */
class BaseModel extends FinEsDataModel {

  // Base Model never matches
  static types = [];

  constructor(name='base') {

    super(name);
    this.schema = schema;  // Common schema for all experts data models
    // this.pipelineBody = ingest_pipeline;
    this.transformService = "node";

  }

  /** @inheritdoc */
  getDefaultIndexConfig(schema) {
    if( !schema ) {
      schema = this.schema;
    }
    var newIndexName = `${this.modelName}-${Date.now()}`;

    return {
      index: newIndexName,
      body : {
        settings : settings,
        mappings : schema
      }
    }
  }

  /**
   * @method is
   * @description Determines if this model can handle the given file based on
   * it's type.
   */
  is(id,types,workflows) {
    //console.log('constructor', this.constructor.types, 'vs', types);
    if (typeof types === 'string') types = [types];
    types = types.filter(x => this.constructor.types.includes(x));
    if (types.length === 0) {
      //console.log(`!${this.constructor.name}.is`);
      return false;
    }
    //console.log(`+${this.constructor.name}.is(${types.join(",")} is a valid type)`);
    return true
  }

  /**
   * @method get_node_by_related_id
   * @description Get elasticsearch node by id
   * @param {Object} doc : elasticsearch doc
   * @param {String} id : node id
   * @returns {Object} : elasticsearch node
   **/
  get_node_by_related_id(doc,id) {
    const nodes = [];
    for(let i=0; i<doc['@graph'].length; i++) {
      if (Array.isArray(doc['@graph'][i]?.['relatedBy'] )) {
        for (let k = 0; k < doc['@graph'][i]['relatedBy'].length; k++) {
          if (doc['@graph'][i]['relatedBy'][k]['@id'] === id) {
            nodes.push(doc['@graph'][i]);
            continue;
          }
        }
      } else {
        if ( doc['@graph'][i]?.['relatedBy']?.['@id'] === id ) {
          nodes.push(doc['@graph'][i]);
        }
      }
    }
    if (nodes.length === 0) {
      throw new Error(`Unable to find node with relatedBy{"@id"="${id}"}`);
    }
    if (nodes.length > 1) {
      throw new Error(`Found multiple nodes with relatedBy{"@id"="${id}"}`);
    }
    return nodes[0];
  }

    /**
   * @method get_nodes_by_type
   * @description Return the node(s) in the graph that corresponds to the '@type'
   * @param {String} doc :  document
   * @param {Object or Array} type : type, or array of types to match
   *
   * @returns {Array} : nodes in the graph that match by type
   **/
  get_nodes_by_type(doc,want_types) {
    const nodes = [];
    if (typeof want_types === 'string') want_types = [want_types];
    for(let i=0; i<doc['@graph'].length; i++) {
      let node = doc['@graph'][i];
      let types= node["@type"];
      if (typeof types === 'string') types = [types];
      types = types.filter(x => want_types.includes(x));
      if (types.length > 0) {
        nodes.push(node);
      }
    }
    return nodes;
  }

  /**
   * @method get_expected_node_by_type
   * @description Return single/expected node in the graph that corresponds to the '@type'
   * @param {String} doc :  document
   * @param {Object or Array} type : type, or array of types to match
   *
   * @returns {Object} : node in the graph matched by type
   * @error {Error} : if no node in the graph matches the type, or if more than one node matches the type
   **/
  get_expected_node_by_type(doc,want_types) {
    const nodes = this.get_nodes_by_type(doc,want_types);
    if (nodes.length === 0) {
      throw new Error(`get_expected_node_by_type: Unable to find node in ${doc['@id']} with type ${want_types.join(",")}`);
    }
    if (nodes.length > 1) {
      throw new Error(`get_expected_node_by_type: Found multiple nodes in ${doc['@id']} with type ${want_types.join(",")}`);
    }
    return nodes[0];
  }

  /**
   * @method get_expected_model_node
   * @description Return single/expected node in the graph that corresponds to the '@type' of the model
   * @param {Object} doc :  document
   * @returns {Object} : node in the graph matched by type
   * @error {Error} : if no node in the graph matches the type, or if more than one node matches the type
   **/
  get_expected_model_node(doc) {
    const types = this.constructor.transformed_types;
    return this.get_expected_node_by_type(doc,types);
  }

  /**
   * @method experts_node_type
   * @description Get the experts node type for the given type
   * @param {String} node
   */
  experts_node_type(node) {
    const Types = ['Expert','Work','Grant','GrantRole','Authorship'];
    let types;
    // Look for valid type in index
    types=node['@type'];
    if (typeof types === 'string') types = [types];
    types = types.filter(x => Types.includes(x));
    if (types.length > 1)
      throw new Error(`node/doc ${node['@id']} has multiple types: ${types.join(",")}`);
    if (types.length == 0)
            throw new Error(`node/doc ${node['@id']} has no matching type:`);
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

  /**
   * @method promote_node_to_doc
   * @description Promotes some node fields to document fields
   * @param {Object} node
   * @returns {Object} : document
   **/
  promote_node_to_doc(node) {
    const doc = {
      "@context": config?.server?.url+"/api/schema/1/context.jsonld",
      "@id": node['@id'],
      name: node['name'],
      "@graph": [node]
    };
    ["@type","status","is-visible","updated","identifier"].forEach(key => {
      if (node[key]) doc[key] = node[key];
    });
    return doc;
  }

  /**
   * @method update_or_create_doc_from_graph_node
   * @description Update main @node of a document. Create if document does not exist.
   * @param {String} document_id
   * @param {Object} node_to_update
   *
   * @returns {Promise} : Elasticsearch response Promise
   */
  async update_or_create_doc_from_graph_node(node) {
    const doc = this.promote_node_to_doc(node);
    const roles = await this.getAccessRoles(doc);

    return this.client.index({
      index : this.writeIndexAlias,
      id : doc['@id'],
      body: {
        ...doc,
        roles: roles}
    });
  }


  /** vvvv TEMPLATE SEARCH vvvv **/


  /**
   * @method common_parms
   * @description fixup parms for template searches
   * @returns object
   */
  common_parms(in_params) {
    const params = {
      size:10,
      from:0,
      ...in_params
    }
    // convert page to from if from is not set
    if (params.from === 0 && params.page > 1) {
      params.from = (params.page - 1) * params.size;
    }
    return params;
  }

  /**
   * @method verify_template
   * @description Adds template to elastic search if it doesn't exist
   */
    async verify_template(template) {
    if (!Array.isArray(template)) {
      template = [template];
    }
    for (let t of template) {
      try {
        logger.info(`checking template ${t.id}`);
        let result = await this.client.getScript({id:t.id});
      } catch (err) {
        try {
          logger.info(`adding template ${t.id}`);
          const result=await this.client.putScript(t);
        } catch (err) {
          throw new Error(`verify_template: ${err}`);
        }
      }
    }
    return true;
  }

  /**
   * @method verify_ingest_pipeline
   * @description Adds ingest pipeline to elastic search if it doesn't exist
   */
  async verify_ingest_pipeline(pipelineId, pipelineBody) {
    try {
      // Check if the pipeline exists
      logger.info(`checking pipeline ${pipelineId}`);
      await this.client.ingest.getPipeline({ id: pipelineId });
      logger.info(`Pipeline ${pipelineId} already exists.`);
    } catch (err) {
        try {
          await this.client.ingest.putPipeline({
            id: pipelineId,
            body: pipelineBody
          });
          logger.info(`Pipeline ${pipelineId} created.`);
        } catch (err) {
          throw new Error(`verify_ingest_pipeline: ${err}`);
        }
    }
  }

  compact_search_results(results,params) {
    const compact = {
      params,
      total: results.hits.total.value
    }
    const hits=[];
    for (const hit of results.hits.hits) {
      const source = hit._source;
      const in_hits = hit?.inner_hits?.["@graph"].hits.hits;
      const inner_hits = [];
      if (in_hits) {
        for (const in_hit of in_hits) {
          inner_hits.push(in_hit._source);
        }
      }
      if (inner_hits.length > 0) {
        source._inner_hits = inner_hits;
      }
      hits.push(source);
    }
    compact.hits = hits;
    const aggregations = {};
    for (const key in results.aggregations) {
      aggregations[key] = {}
      const buckets = results.aggregations[key].buckets;
      for (const bucket of buckets) {
        aggregations[key][bucket.key] = bucket.doc_count;
      }
    }
    compact.aggregations = aggregations;
    return compact;
  }
  /**
   * @method render
   * @description return an ES ready nested search using a template
   * @returns string
   */
  async render(opts) {
    // Throw error to see stack trace
    // try { throw new Error('Stack Trace'); }
    // catch(err) { console.log(err.stack); }

    const params = this.common_parms(opts.params);

    const options = {
      id: (opts.id)?opts.id:"default",
      params
    }
    // Check if template exists, install if not
    await this.verify_template(options);

    const template = await this.client.renderSearchTemplate(options);
    return template;
  }

  /**
   * @method search
   * @description ES search using a template
   * @returns {Object} ES results
   */
  async search(opts) {
    const params = this.common_parms(opts.params);

    const index = params.index || ['grant-read','expert-read'];
    //const index = '*-read';
    delete params.index;
    const options = {
      id: (opts.id)?opts.id:"default",
      index,
      params
    }
    console.log(`searching ${JSON.stringify(options)}`);
    const res=await this.client.searchTemplate(options);
    return this.compact_search_results(res,params);
  }

  async msearch(opts) {

    if (! opts.index) {
      opts.index = this.readIndexAlias;
    }

    // Fix-up parms
    for(let i=0;i<opts.search_templates.length;i++) {
      let template=opts.search_templates[i];
      if(template?.params) {
        template.params = this.common_parms(template.params);
      }
    }

    const res=await this.client.msearchTemplate(opts);
    //console.log(res);
    // Compact each result
    for(let i=0;i<res.responses.length;i++) {
      res.responses[i] = this.compact_search_results(
        res.responses[i],
        // search_templates are in pairs.  So get second of pair
        opts.search_templates[2*i+1].params);
    }
    return res.responses;
  }

  /** ^^^^TEMPLATE SEARCH^^^^ **/

  /**
   * @method esMatchNode
   * @description Return all documents that match the given node property value
   * @param {Object} matches :  object of key:value pairs to match
   * @returns {Promise} : Elasticsearch search Promise
   */

  async esMatchNode(matches) {
    const must=[];
    for (const key in matches) {
      if (matches.hasOwnProperty(key)) {
        let t={};
        t['@graph.'+key]={"value": matches[key]};
        must.push({"term": t});
      }
    }
    return this.esSearch(
        {
          query: {
            nested:{
              path: "@graph",
              query: {bool: {must: must}}
            }
          },
          size: 10000
        });
  }

  /**
   * @method get
   * @description Get document via _id.
   * @param {String} id : _id of document to get
   * @param {Object} options : options for get (like _source:false)
   */
  async client_get(id,options={}) {
    // console.log(`FinEsNestedModel.client_get(${id}) on ${this.readIndexAlias}`);
    const result = await this.client.get(
      {
        ...{
          index: this.readIndexAlias,
          id: id,
          _source: true
        },
        ...options
      }
    )
    return result._source;
    }

    /**
   * @method get
   * @description get a object by id
   *
   * @param {String} id @graph.identifier or @graph.@id
   *
   * @returns {Promise} resolves to elasticsearch result
   */
  async get(id, opts={}, index) {
    if( id[0] === '/' ) id = id.substring(1);
    let _source_excludes = true;
    if( opts.admin ) _source_excludes = false;
    else if( opts.compact ) _source_excludes = 'compact';

    let result= await this.client.get(
      {
        index: this.readIndexAlias,
        id: id,
        _source: true,
	      _source_excludes: _source_excludes
      }
    );

    if( result ) {
      if ( !opts.full ) {
        // default is to return the _source part of the result only
        result = result._source;
      }
      return result;
      //if( opts.compact ) this.utils.compactAllTypes(result);
      //if( opts.singleNode ) result['@graph'] = this.utils.singleNode(id, result['@graph']);
    } else {
      return null;
    }

    // Add fcrepo and dbsync data if admin, for the dashboard
    if( opts.admin === true ) {
      try {
        let response = await api.metadata({
          path : id,
          host : config.gateway.host
        });
        if( response.data.statusCode === 200 ) {
          result.fcrepo = JSON.parse(response.data.body);
        } else {
          result.fcrepo = {
            error: true,
            body : response.data.body,
            statusCode : response.data.statusCode
          }
        }
      } catch(e) {
        result.fcrepo = {
          error: true,
          message : e.message,
          stack : e.stack
        }
      }

      try {
        result.dbsync = {};
        let response = await this.pg.query('select * from dbsync.update_status where path = $1', [id]);
        if( response.rows.length ) result.dbsync[id] = response.rows[0];

        response = await this.pg.query('select * from dbsync.update_status where path = $1', [id+'/fcr:metadata']);
        if( response.rows.length ) result.dbsync[id+'/fcr:metadata'] = response.rows[0];
      } catch(e) {
        result.dbsync = {
          message : e.message,
          stack : e.stack
        }
      }
    }

    return result;
  }


  /**
   * @method delete_graph_node
   * @description delete one node of the @graph of a document. The document must exist.
   * @param {String} document_id
   * @param {Object} node : node to delete, uses node["@id"] for deletion
   *
   * @returns {Promise} : Elasticsearch response Promise
   */
  async delete_graph_node(document_id, node_to_delete) {
    return this.client.update({
      index: this.writeIndexAlias,
      id : document_id,
      retry_on_conflict : this.UPDATE_RETRY_COUNT,
      // refresh : 'wait_for',
      script : {
        source : `
   ctx._source['@graph'].removeIf((Map item) -> { item['@id'] == params.node['@id'] });`,
         params : {node: node_to_delete}
      }
    });
  }

  /**
   * @method update_graph_node
   * @description Update one node of the @graph of a document. The document must exist.
   * @param {String} document_id
   * @param {Object} node_to_update
   * @param {Boolean} is_visible : true if the node is visible, Delete node if false
   *
   * @returns {Promise} : Elasticsearch response Promise
   */
  async update_graph_node(document_id, node_to_update ) {
      return this.client.update({
        index: this.writeIndexAlias,
        id : document_id,
        retry_on_conflict : this.UPDATE_RETRY_COUNT,
        // refresh : 'wait_for',
        script : {
          source : `
   ctx._source['@graph'].removeIf((Map item) -> { item['@id'] == params.node['@id'] });
   ctx._source['@graph'].add(params.node);`,
          params : {node: node_to_update}
        }
      });
  }

  /**
   * @method update_graph_node_if_document_exists
   * @description Update one node of the @graph of a document. returns {} if document does not exist.
   * @param {String} document_id
   * @param {Object} node_to_update
   *
   * @returns {Promise} : Elasticsearch response Promise
   */
  async update_graph_node_if_document_exists(document_id, node_to_update) {
    try {
      const doc = await this.get(document_id,{_source:false});
    } catch (err) {
      // console.log(`update_graph_node_if_document_exists: document ${document_id} does not exist`);
      return {};
    }
    return this.update_graph_node(document_id,node_to_update);
  }

  /**
   * @method update_or_create_main_node_doc
   * @description Update main @node of a document. Create if document does not exist.
   * @param {String} document_id
   * @param {Object} node_to_update
   *
   * @returns {Promise} : Elasticsearch response Promise
   */
  async update_or_create_main_node_doc(doc) {
    // ensure the document exists
    const roles = await this.getAccessRoles(doc);
    //console.log(`update_or_create_main_node_doc: document ${doc['@id']}, @graph.length=${doc['@graph'].length}`);
    if (doc['@graph'].length != 1) {
      throw new Error(`update_or_create_main_node_doc: document ${doc['@id']}, @graph.length=${doc['@graph'].length} != 1`);
    }
    if (doc['@id'] != doc['@graph'][0]['@id']) {
      throw new Error(`update_or_create_main_node_doc: document ${doc['@id']}, @id does not match @graph[0]['@id']`);
    }
    // No idea what roles do
    doc.roles = roles;
    return this.client.index({
      index : this.writeIndexAlias,
      id : doc['@id'],
      document: doc
    });
  }

  /**
   * @method delete
   * @description delete the document in elasticsearch.  This method will
   * delete the document in elasticsearch.  It will also delete the document
   * in the database.
   *
   * @returns {Promise} resolves to elasticsearch response
   **/
  async delete(id) {
    return this.client.delete({id,index:this.writeIndexAlias})
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
module.exports = BaseModel;
