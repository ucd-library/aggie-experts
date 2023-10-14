const {BaseService} = require('@ucd-lib/cork-app-utils');
const PersonStore = require('../stores/PersonStore');

class PersonService extends BaseService {

  constructor() {
    super();
    this.store = PersonStore;

    this.baseUrl = '/api/person';
  }

  get(id) {
    return this.request({
      url : `${this.baseUrl}/${id}`,
      checkCached : () => this.store.getPerson(id),
      onLoading : request => this.store.setPersonLoading(id, request),
      onLoad : result => this.store.setPersonLoaded(id, result.body),
      onError : e => this.store.setPersonError(id, e)
    });
  }

}

module.exports = new PersonService();
