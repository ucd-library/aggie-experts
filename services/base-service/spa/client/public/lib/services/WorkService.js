const {BaseService} = require('@ucd-lib/cork-app-utils');
const WorkStore = require('../stores/WorkStore');

class WorkService extends BaseService {

  constructor() {
    super();
    this.store = WorkStore;

    this.baseUrl = '/api/work';
  }

  get(id) {
    return this.request({
      url : `${this.baseUrl}/${id}`,
      checkCached : () => this.store.getWork(id),
      onLoading : request => this.store.setWorkLoading(id, request),
      onLoad : result => this.store.setWorkLoaded(id, result.body),
      onError : e => this.store.setWorkError(id, e)
    });
  }

  /**
   * @method search
   * @description Search for works
   *
   * @param {Object} searchDocument es search document
   *
   * @returns {Promise}
   */
  async search(searchDocument = {}, opts={}) {
    // TODO
    return;

    if( !opts.compact ) opts.compact = true;

    searchDocument.textFields = config.elasticSearch.textFields.work;
    return this.request({
      url : this.baseUrl,
      qs : opts,
      json : true,
      fetchOptions : {
        method : 'POST',
        body : JSON.searchDocument
      },
      onLoading : promise => this.store.setSearchLoading(searchDocument, promise),
      onLoad : result => {
        if( result.body.results ) {
          result.body.results = result.body.results.map(record => new RecordGraph(record));
        }
        this.store.setSearchLoaded(searchDocument, result.body)
      },
      onError : e => this.store.setSearchError(searchDocument, e)
    });
  }

}

module.exports = new WorkService();
