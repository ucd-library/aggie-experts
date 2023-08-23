const {config, dataModels} = require('@ucd-lib/fin-service-utils');
const {FinEsDataModel} = dataModels;

/**
 * @class FinEsNestedModel
 * @description Fin Nested Elasticsearch data model.  This class provides
 methods for updating an Elasticsearch document model that uses nested indexes
 for nodes in the the @graph space.  It's currently a wrapper around the
 FinEsDataModel, ~/fin/services/fin/node-utils/lib/data-models/elastic-search/,
 class.  But, I'm not sure if we'll keep it that way.
 */
class FinEsNestedModel extends FinEsDataModel {

    /**
    * @method constructor
    * @description constructor, see FinEsDataModel for params
    */
  constructor(modelName) {
    super(modelName);
    }

  /**
   * @method esSearchGraph
   * @description Perform a nested graph search of the given query.
   * @param {String} query
   */
  async esSearchGraph(query) {
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

  async esMatchNode(matches) {
    const must=[];
    for (const key in matches) {
      if (matches.hasOwnProperty(key)) {
        let t={};
        t['@graph.'+key]={"value": matches[key]};
        must.push({"term": t});
      }
    }
    return this.esSearchGraph({bool: {must: must}});
  }

  /**
   * @method get
   * @description Get document via _id.
   * @param {String} id : _id of document to get
   * @param {Object} options : options for get (like _source:false)
   */
  async get(id,options) {
    console.log(`FinEsNestedModel.get(${id}) on ${this.readIndexAlias}`);
    return this.client.get(
      {
        ...{
          index: this.readIndexAlias,
          id: id,
          _source: true
        },
        ...options
      }
      )
    }

  /**
   * @method get_main_graph_node
   * @description Return the node in the graph that corresponds to the '@id'
   * @param {String} doc :  document
   *
   * @returns {Object} : node in the graph that corresponds to the '@id'
   * @error {Error} : if no node in the graph corresponds to the '@id'
   **/
  get_main_graph_node(doc) {
    //console.log(`doc ${doc['@id']} has ${doc['@graph'].length} records`);
    for(let i=0; i<doc['@graph'].length; i++) {
      let node = doc['@graph'][i];
//      console.log(i,"->",node['@id']);
      if (doc['@id']===node['@id']) {
        return doc['@graph'][i];
      }
    }
    throw new Error(`get_main_graph_node: Unable to find main graph node for ${doc['@id']}`);
  }


  /**
   * @method update_graph_node
   * @description Update one node of the @graph of a document. The document must exist.
   * @param {String} document_id
   * @param {Object} node_to_update
   *
   * @returns {Promise} : Elasticsearch response Promise
   */
  async update_graph_node(document_id, node_to_update) {
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
      console.log(`update_graph_node_if_document_exists: document ${document_id} does not exist`);
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

    if (doc['@graph'].length != 1) {
      throw new Error(`update_or_create_main_node_doc: document ${doc['@id']}, @graph.length=${doc['@graph'].length} != 1`);
    }
    if (doc['@id'] != doc['@graph'][0]['@id']) {
      throw new Error(`update_or_create_main_node_doc: document ${doc['@id']}, @id does not match @graph[0]['@id']`);
    }
    //
    doc['@graph'][0]['is_main_node'] = true;

    return this.client.index({
      index : this.writeIndexAlias,
      id : doc['@id'],
      body: {
        '@id': doc['@id'],
        '@graph': doc['@graph'],
        roles: roles}
    });
  }

  /**
   * @method update
   * @description update the document in elasticsearch.  This method will
   * update the document in elasticsearch using the data passed to the
   * constructor.  It will also update the document in the database.
   *
   * @returns {Promise} resolves to elasticsearch response
   */
  async update(document_id, doc) {
    if (doc['@graph'][0]['@id']==document_id) {
      return this.update_or_create_main_doc_doc(doc);
    } else {
      return this.update_graph_node_if_document_exists(document_id,doc);
    }
  }

    /**
    * @method delete
    * @description delete the document in elasticsearch.  This method will
    * delete the document in elasticsearch.  It will also delete the document
    * in the database.
    *
    * @returns {Promise} resolves to elasticsearch response
    **/
}
  module.exports = FinEsNestedModel;
