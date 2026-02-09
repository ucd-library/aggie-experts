const es = require('./es-client.js');
const config = require('./config.js');
const logger = require('./logger.js');

/**
 * @class EsDataModel
 * @description Base class for Elasticsearch data models.
 */
class EsDataModel {

  constructor(modelName) {
    // super(modelName);

    this.UPDATE_RETRY_COUNT = 10;

    this.readIndexAlias = modelName+'s-current';
    this.writeIndexAlias = modelName+'s-current';

    this.client = es;
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
    let _source_excludes = true;
    if( opts.admin ) _source_excludes = false;
    else if( opts.compact ) _source_excludes = 'compact';

    let identifier = id.replace(/^\//, '').split('/');
    identifier.shift();
    identifier = '/'+identifier.join('/');

    let result = await this.esSearch({
        from: 0,
        size: 1,
        query: {
          term: { '@id': id }
        }
      }, {
        _source_excludes,
        roles: opts.roles
      }, index
    );

    if( result.hits.total.value >= 1 ) {
      result = result.hits.hits[0]._source;

      if( opts.compact ) this.utils.compactAllTypes(result);
      if( opts.singleNode ) result['@graph'] = this.utils.singleNode(id, result['@graph']);
    } else {
      return null;
    }

    return result;
  }

  /**
   * @method esScroll
   * @description scroll a search request (retrieve the next set of results) after specifying the scroll parameter in a search() call.
   * https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#api-scroll
   *
   * @param {Object} options
   * @param {String} options.scrollId current scroll id
   * @param {String} options.scroll time to keep open
   *
   * @returns {Promise} resolves to elasticsearch result
   */
  esScroll(options={}) {
    return es.scroll(options);
  }

  esClearScroll(options={}) {
    return es.clearScroll(options);
  }

  /**
   * @method esSearch
   * @description search the elasticsearch collections using
   * es search document
   *
   * @param {Object} body elasticsearch search body
   *
   * @returns {Promise} resolves to elasticsearch result
   */
  esSearch(body = {}, options={}, index) {
    if( !index ) index = this.readIndexAlias;

    options.index = index;
    options.body = body;

    this.setRoles(body, options.roles);
    if( options.roles ) delete options.roles;

    if( options._source_excludes === false ) {
      delete options._source_excludes;
    } else if( options._source_excludes === 'compact' ) {
      options._source_excludes = config.elasticsearch.fields.excludeCompact.join(',');
    } else if( Array.isArray(options._source_excludes) ) {
      options._source_excludes = options._source_excludes.join(',');
    } else {
      options._source_excludes = config.elasticsearch.fields.exclude.join(',');
    }

    if( Array.isArray(options._source_includes) ) {
      options._source_includes = options._source_includes.join(',');
    }

    if( options.admin ) {
      delete options.admin;
      if( options._source_excludes && options._source_excludes.includes('roles') ) {
        options._source_excludes.splice(options._source_excludes.indexOf('roles'), 1);
      }
    }


    return this.client.search(options);
  }

  async count(index) {
    if( !index ) index = this.readIndexAlias;
    return (await this.client.count({index})).count;
  }

  /**
   * @method ensureIndex
   * @description make sure given index exists in elastic search
   *
   * @returns {Promise}
   */
  async ensureIndex() {
    let exits = await this.client.indices.existsAlias({name: this.readIndexAlias});
    if( exits ) return;

    logger.info(`No alias exists for ${this.id}, creating...`);

    let indexName = await this.createIndex();
    this.setAlias(indexName, this.readIndexAlias);
    this.setAlias(indexName, this.writeIndexAlias);

    logger.info(`Index ${indexName} created pointing with aliases ${this.readIndexAlias} and ${this.writeIndexAlias}`);
  }

  /**
   * @method createIndex
   * @description create new new index with a unique name based on alias name
   *
   * @param {String} name model name to base index name off of
   *
   * @returns {Promise} resolves to string, new index name
   */
  async createIndex() {
    let indexDef = this.getDefaultIndexConfig();
    await this.client.indices.create(indexDef);

    return indexDef.index;
  }

  /**
   * @method getCurrentIndexes
   * @description given a index alias name, find all real indexes that use this name.
   * This is done by querying for all indexes that regex for the alias name.  The indexers
   * index name creation always uses the alias name in the index.
   *
   * @param {String} alias name of alias to find real indexes for
   * @return {Promise} resolves to array of index names
   */
  async getCurrentIndexes(alias) {
    var re = new RegExp('^'+alias);
    var results = [];

    try {
      var resp = await this.client.cat.indices({v: true, format: 'json'});
      resp.forEach((i) => {
        if( i.index.match(re) ) {
          results.push(i);
        }
      })
    } catch(e) {
      throw e;
    }

    return results;
  }

  async setAlias(indexName, alias) {
    if( !alias.startsWith(this.modelName+'-') ) {
      alias = this.modelName + '-' + alias;
    }

    // remove all current pointers
    let exits = await this.client.indices.existsAlias({name: alias});
    if( exits ) {
      let currentAliases = await this.client.indices.getAlias({name: alias});
      for( let index in currentAliases ) {
        logger.info('Removing alias: ', {index, name: alias})
        await this.client.indices.deleteAlias({index, name: alias});
      }
    }

    return this.client.indices.putAlias({index: indexName, name: alias});
  }

  async recreateIndex(indexSource) {
    // create new index
    let indexDest = await this.createIndex();

    // set new index as new write source
    await this.setAlias(indexDest, this.writeIndexAlias);

    // now copy over source indexes data
    let response = await this.client.reindex({
      wait_for_completion : false,
      body: {
        source: { index: indexSource },
        dest: { index: indexDest }
      }
    });

    return {destination: indexDest, response}
  }

  async setRoles(body, roles) {
    if( !roles ) {
      roles = [config.finac.agents.public];
    } else if( !roles.includes(config.finac.agents.public) ) {
      roles.push(config.finac.agents.public);
    }

    if( !body.query ) body.query = {};
    if( !body.query.bool ) body.query.bool = {};
    if( !body.query.bool.filter ) body.query.bool.filter = [];
    let hasRoles = body.query.bool.filter.findIndex(item => item?.terms?.roles);

    if( hasRoles === -1 ) {
      body.query.bool.filter.push({
        terms : {roles}
      });
      return;
    }

    body.query.bool.filter[hasRoles].terms.roles = roles;
  }

  async getAccessRoles(jsonld) {
    let roles = [];
    let acl = await this.finac.getAccess(jsonld['@id'], false)
    if( acl.protected === true ) {
      acl.readAuthorizations.forEach(role => {
        if( !config.finac.agents[role] ) {
          roles.push(role);
          return;
        }

        // discover role is public metadata access
        if( role === config.finac.agents.discover ) {
          roles.push(config.finac.agents.public);
          return;
        }

        // protected is only accessible by agents with promoted role
        // as well as admins
        if( role === config.finac.agents.protected ) {
          roles.push(config.finac.agents.protected+'-'+jsonld['@id']);
          roles.push(config.finac.agents.admin);

          // add collection access roles
          if( jsonld.isPartOf ) {
            let isPartOf = jsonld.isPartOf;
            if( !Array.isArray(isPartOf) ) {
              isPartOf = [isPartOf];
            }

            isPartOf.forEach(item => {
              if( item['@id'] && item['@id'].match(/\/collection\//) ) {
                roles.push(config.finac.agents.protected+'-'+item['@id']);
              }
            });
          }
        }

      });
    } else { // not protected by finac
      roles.push(config.finac.agents.public);
    }

    return roles;
  }


  getDefaultIndexConfig(schema) {
    if( !schema ) {
      schema = this.schema;
    }
    var newIndexName = `${this.modelName}-${Date.now()}`;

    return {
      index: newIndexName,
      body : {
        settings : {
          analysis : {
            analyzer: {
              autocomplete: {
                tokenizer: 'autocomplete',
                filter: [
                  'lowercase'
                ]
              },
              autocomplete_search : {
                tokenizer: "lowercase"
              },
              punctuation_insensitive: {
                tokenizer: "standard",
                filter: ["lowercase", "remove_punctuation"]
              }
            },
            tokenizer: {
              autocomplete: {
                type: 'edge_ngram',
                min_gram: 1,
                max_gram: 20,
                token_chars: [
                  "letter",
                  "digit"
                ]
              },

              xml: {
                type: 'char_group',
                'tokenize_on_chars': [
                  '-', '.', ',', '>', '<', ' '
                ]
              }
            },
            filter: {
              "remove_punctuation": {
                type: "pattern_replace",
                pattern: "[^\\w\\s]",
                replacement: ""
              }
            }
          }
        },
        mappings : schema
      }
    }
  }

}

module.exports = EsDataModel;
