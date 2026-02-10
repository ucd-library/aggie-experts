const {BaseService} = require('@ucd-lib/cork-app-utils');
const SchemaStore = require('../stores/SchemaStore.js');
const payloadUtils = require('../payload.js').default;

class SchemaService extends BaseService {

  constructor() {
    super();
    this.store = SchemaStore;
    this.baseUrl = '/api/schema';
  }

  async getIndexes() {
    return this.request({
      url : `${this.baseUrl}/es/indexes`,
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async setAlias(aliasName) {
    console.log('TODO update stage alias to be current', aliasName)

    return;

    return this.request({
      url : `${this.baseUrl}/es/indexes`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          "alias" : aliasName
        })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

}

module.exports = new SchemaService();
