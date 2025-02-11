const {BaseService} = require('@ucd-lib/cork-app-utils');
const WorkStore = require('../stores/WorkStore');
const payloadUtils = require('../payload.js').default;

class WorkService extends BaseService {

  constructor() {
    super();
    this.store = WorkStore;

    this.baseUrl = '/api/work';
  }

  async get(workId) {
    let ido = {workId};
    let id = payloadUtils.getKey(ido);

    await this.request({
      url : `${this.baseUrl}/${encodeURIComponent(workId)}`,
      checkCached : () => this.store.data.byId.get(id),
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data.byId
      )
    });

    return this.store.data.byId.get(id);
  }

}

module.exports = new WorkService();
