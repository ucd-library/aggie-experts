// Can use this to get the fin configuration
const EsDataModel = require('../../lib/es-model.js');
const logger = require('../../lib/logger.js');
const config = require('../../lib/config.js');
// const models = require('../../lib/models.js');
const schema = require('./schema/minimal.json');
const settings = require('./schema/settings.json');

/**
 * @class BaseModel
 * @description Base class for Aggie Experts data models.  This class provides
 methods for updating an Elasticsearch document model that uses nested indexes
 for nodes in the the @graph space.  It's currently a wrapper around the
 FinEsDataModel, ~/fin/services/fin/node-utils/lib/data-models/elastic-search/,
 class.  But, I'm not sure if we'll keep it that way.
 */
class BaseModel extends EsDataModel {

  // Base Model never matches
  static types = [];

  constructor(name='base') {

    super(name);
    this.schema = schema;  // Common schema for all experts data models
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
    ["@type","status","type","is-visible","updated","identifier"].forEach(key => {
      if (node[key]) doc[key] = node[key];
    });
    return doc;
  }

  async getAvailableIndexes() {
    return await this.client.indices.get({ index: '*' });
  }

  async getAvailableAliases() {
    return await this.client.indices.getAlias();
  }

  async setReadWriteIndexes(indexSuffix) {
    this.readIndexAlias = this.modelName+'s-'+indexSuffix;
    this.writeIndexAlias = this.modelName+'s-'+indexSuffix;
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
   * @method compact_search_results
   * @description Compact ES search results into simpler format
   * @returns object
   */
  compact_search_results(results, params) {
    const compact = {
      params,
      total: results?.hits?.total?.value ?? 0
    };

    // hits + inner_hits
    const hits = [];
    for (const hit of results?.hits?.hits ?? []) {
      const source = hit._source || {};
      const in_hits = hit?.inner_hits?.['@graph']?.hits?.hits;
      if (Array.isArray(in_hits) && in_hits.length) {
        source._inner_hits = in_hits.map(h => h._source);
      }
      hits.push(source);
    }
    compact.hits = hits;

    const aggregations = {};
    const aggs = results.aggregations;
    if (!aggs || typeof aggs !== 'object') {
      compact.aggregations = aggregations;
      return compact;
    }

    // helper to find first buckets array under a node
    function findBuckets(node) {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node.buckets)) return node.buckets;
      for (const k of Object.keys(node)) {
        if (k === 'meta' || k === 'value' || k === 'doc_count') continue;
        const b = findBuckets(node[k]);
        if (b) return b;
      }
      return null;
    }

    // --- Special handling for issued_years (merge works + grants) ---
    // Check if we have global_aggs wrapper (new structure)
    const issuedYearsNode = aggs.global_aggs?.all_results?.issued_years || aggs.issued_years;
    
    if (issuedYearsNode) {
      const outCombined = {}; // yearEpoch -> totalCount
      const outWorks = {};
      const outGrants = {};

      // Works buckets
      const worksBuckets =
        issuedYearsNode?.works?.years?.buckets ||
        findBuckets(issuedYearsNode?.works?.years) ||
        [];

      for (const b of worksBuckets) {
        const key = String(b.key);
        const val =
          b?.unique_works?.value ??
          b?.parent_docs?.unique_parents?.value ??
          b?.doc_count ?? 0;
        outCombined[key] = (outCombined[key] || 0) + (typeof val === 'number' ? val : 0);
        outWorks[key] = (outWorks[key] || 0) + (typeof val === 'number' ? val : 0);
      }

      // Grants buckets
      const grantsBuckets =
        issuedYearsNode?.grants_active?.years?.buckets ||
        findBuckets(issuedYearsNode?.grants_active?.years) ||
        [];

      for (const b of grantsBuckets) {
        const key = String(b.key);
        const val =
          b?.unique_grants?.value ??                       // new metric
          b?.parent_docs?.unique_parents?.value ??         // fallback (unique roots)
          b?.doc_count ?? 0;                               // last resort
        outCombined[key] = (outCombined[key] || 0) + (typeof val === 'number' ? val : 0);
        outGrants[key] = (outGrants[key] || 0) + (typeof val === 'number' ? val : 0);
      }

      // Ensure per-type maps include every year present in outCombined
      // So the ui can show 0 counts for missing years and not have differences in years between all results/works/grants
      for (const yearKey of Object.keys(outCombined)) {
        if (!(yearKey in outWorks)) outWorks[yearKey] = 0;
        if (!(yearKey in outGrants)) outGrants[yearKey] = 0;
      }

      aggregations['issued_years_combined'] = outCombined;
      aggregations['issued_years_works'] = outWorks;
      aggregations['issued_years_grants'] = outGrants;
    }

    // Build global (unfiltered) facets from root aggs (excluding wrappers)
    const globalFacets = {};
    for (const key of Object.keys(aggs)) {
      if (['issued_years','global_aggs','filtered_facets'].includes(key)) continue;
      const buckets = findBuckets(aggs[key]);
      if (!buckets) continue;
      globalFacets[key] = {};
      for (const bucket of buckets) {
        const k = String(bucket.key ?? bucket.key_as_string ?? '');
        if (!k) continue;
        const parentDocs = bucket.parent_docs;
        if (parentDocs?.unique_parents && typeof parentDocs.unique_parents.value === 'number') {
          globalFacets[key][k] = parentDocs.unique_parents.value;
        } else if (typeof bucket.doc_count === 'number') {
          globalFacets[key][k] = bucket.doc_count;
        }
      }
    }

    // Add issued years raw node for debugging/reference

    // Filtered facets (date constrained) if present
    let filteredFacets = {};
    if (aggs.filtered_facets) {
      ['@type','status','type','availability'].forEach(f => {
        if (!aggs.filtered_facets[f]) return;
        const buckets = findBuckets(aggs.filtered_facets[f]);
        if (!buckets) return;
        filteredFacets[f] = {};
        for (const bucket of buckets) {
          const k = String(bucket.key ?? bucket.key_as_string ?? '');
          if (!k) continue;
          const parentDocs = bucket.parent_docs;
          if (parentDocs?.unique_parents && typeof parentDocs.unique_parents.value === 'number') {
            filteredFacets[f][k] = parentDocs.unique_parents.value;
          } else if (typeof bucket.doc_count === 'number') {
            filteredFacets[f][k] = bucket.doc_count;
          }
        }
      });
    } else {
      // No date filter: filtered = global
      filteredFacets = globalFacets;
    }

    compact.global_aggregations = globalFacets;
    compact.aggregations = filteredFacets;
    // Option A years aggregation parsing (works/grants with per-year status/type)
    if (aggs.years) {
      const yearsAgg = aggs.years;
      const worksBuckets =
        yearsAgg.works?.works_nested?.filtered?.years?.buckets ||
        findBuckets(yearsAgg.works?.works_nested?.filtered?.years) ||
        [];
      const grantsBuckets =
        yearsAgg.grants?.grants_nested?.filtered?.years?.buckets ||
        findBuckets(yearsAgg.grants?.grants_nested?.filtered?.years) ||
        [];
      const yearsCombined = {}; // epoch -> { works_unique, grants_unique }
      const yearsWorks = {}; // epoch -> { unique, status:{}, type:{} }
      const yearsGrants = {}; // epoch -> { unique, status:{}, type:{} }

      worksBuckets.forEach(b => {
        const key = String(b.key);
        const unique = b.unique_works?.value || 0;
        if (!yearsCombined[key]) yearsCombined[key] = { works_unique: 0, grants_unique: 0 };
        yearsCombined[key].works_unique = unique;
        
        // Use parent_docs aggregation (year bucket already scopes to issued year)
        const statusBuckets = b.parent_docs?.status?.buckets || [];
        const typeBuckets = b.parent_docs?.type?.buckets || [];
        
        yearsWorks[key] = {
          unique,
          status: Object.fromEntries(statusBuckets.map(x => [String(x.key), x.doc_count])),
          type: Object.fromEntries(typeBuckets.map(x => [String(x.key), x.doc_count]))
        };
      });

      grantsBuckets.forEach(b => {
        const key = String(b.key);
        const unique = b.unique_grants?.value || 0;
        if (!yearsCombined[key]) yearsCombined[key] = { works_unique: 0, grants_unique: 0 };
        yearsCombined[key].grants_unique = unique;
        const statusBuckets = b.parent_docs?.status?.buckets || [];
        const typeBuckets = b.parent_docs?.type?.buckets || [];
        const idBuckets = b.grant_ids?.buckets || [];
        
        // Build array of {id, status, type} for each grant in this year
        const grants = idBuckets.map(idBucket => {
          const grantId = String(idBucket.key);
          const statusBkts = idBucket.to_parent?.status?.buckets || [];
          const typeBkts = idBucket.to_parent?.type?.buckets || [];
          // Each grant should have one status/type; pick top bucket
          const status = statusBkts.length ? String(statusBkts[0].key) : '';
          const type = typeBkts.length ? String(typeBkts[0].key) : '';
          return { id: grantId, status, type };
        });
        
        yearsGrants[key] = {
          unique,
          status: Object.fromEntries(statusBuckets.map(x => [String(x.key), x.doc_count])),
          type: Object.fromEntries(typeBuckets.map(x => [String(x.key), x.doc_count])),
          grants
        };
      });

      if (yearsAgg.grants_unique_over_range?.filtered) {
        const filtered = yearsAgg.grants_unique_over_range.filtered;
        compact.grants_unique_over_range = filtered.unique_ids?.value ?? 0;
        if (filtered.ids?.buckets) {
          compact.grant_ids_over_range = filtered.ids.buckets.map(x => String(x.key));
        }
      }

      compact.years_combined = yearsCombined;
      compact.years_works = yearsWorks;
      compact.years_grants = yearsGrants;
    }
    
    return compact;
  }
  /**
   * @method render
   * @description return an ES ready nested search using a template
   * @returns string
   */
  async render(opts) {

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

    const index = params.index; // || ['grants', 'works', 'experts'];
    delete params.index;
    const options = {
      id: (opts.id)?opts.id:"default",
      index,
      params
    }
    
    try {
      const res = await this.client.searchTemplate({
        index: options.index,
        body: { id: options.id, params: options.params }
      });
      const body = res?.body ?? res;
      return this.compact_search_results(body, params);
    } catch (err) {
      console.error('searchTemplate error:', err?.meta?.body || err);
      throw err;
    }
  }

  async msearch(opts) {
    if( !opts.index ) {
      opts.index = this.readIndexAlias;
    }

    // Fix-up parms
    for(let i=0;i<opts.search_templates.length;i++) {
      let template=opts.search_templates[i];
      if(template?.params) {
        template.params = this.common_parms(template.params);
      }
    }

    const res = await this.client.msearchTemplate(opts);
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
  async get(id, opts={}) {
    if( id[0] === '/' ) id = id.substring(1);
    let _source_excludes = true;
    if( opts.admin ) _source_excludes = false;
    else if( opts.compact ) _source_excludes = 'compact';

    opts.index = opts.previewEsIndex || this.readIndexAlias;

    let result = await this.client.get(
      {
        index: opts.index,
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
    // TODO not sure on this
    let esModel;
    if (model === 'grant') {
      esModel = require('../grant/model.js');
    } else if (model === 'work') {
      esModel = require('../work/model.js');
    } else {
      esModel = require('../expert/model.js');
    }
    return esModel;
    // return esModel;
//     const method=model+'Model';
//     if (!(method in this)) {
//       this.method = (await models.get(model)).model;
// //      console.log(`get_model: ${model} not found, loading...`);
//     }
// //    console.log(`get_model: ${model} found`,this.method);
//     return this.method;
  }

  async update(jsonld) {
    throw new Error(`${this.constructor.name}.update(${jsonld['@id']}) not implemented`);
  }

  async remove(jsonld) {
    throw new Error(`${this.constructor.name}.delete(${jsonld['@id']}) not implemented`);
  }
}
module.exports = BaseModel;
