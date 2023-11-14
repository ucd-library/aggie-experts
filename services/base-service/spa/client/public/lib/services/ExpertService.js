const {BaseService} = require('@ucd-lib/cork-app-utils');
const ExpertStore = require('../stores/ExpertStore');

class ExpertService extends BaseService {

  constructor() {
    super();
    this.store = ExpertStore;

    this.baseUrl = '/api/expert';
  }

  get(id, headRequest=false) {
    return this.request({
      url : `${this.baseUrl}/${id}`,
      fetchOptions : {
        method : headRequest ? 'HEAD' : 'GET'
      },
      checkCached : () => this.store.getExpert(id),
      onLoading : request => this.store.setExpertLoading(id, request),
      onLoad : result => this.store.setExpertLoaded(id, result.body),
      onError : e => this.store.setExpertError(id, e)
    });
  }

}

module.exports = new ExpertService();
