const {BaseService} = require('@ucd-lib/cork-app-utils');
const BrowseByStore = require('../stores/BrowseByStore');
const payloadUtils = require('../payload.js').default;

class BrowseByService extends BaseService {

  constructor() {
    super();
    this.store = BrowseByStore;

    this.baseUrl = '/api';
  }

  async browseAZBy(type) {
    let url = `${this.baseUrl}/${type}/browse`;
    type = type.substring(0, 1).toUpperCase() + type.substring(1);
    let storeKey = 'by'+type+'sAZ';

    let id = 'browse'+type+'s:az';
    let ido = {};
    ido['browse'+type+'s'] = 'az';

    await this.request({
      url,
      checkCached : () => this.store.data[storeKey].get(id),
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data[storeKey]
      )
    });

    return this.store.data[storeKey].get(id);
  }

  async browseBy(type, lastInitial, page=1, size=25) {
    let ido = {browseType: type, lastInitial, page, size};
    let id = payloadUtils.getKey(ido);

    type = type.substring(0, 1).toUpperCase() + type.substring(1);
    let storeKey = 'by'+type+'sLastInitial';

    await this.request({
      url : `${this.baseUrl}/${type.toLowerCase()}/browse`,
      qs : { page, size, p : lastInitial.toUpperCase() },
      checkCached : () => this.store.data[storeKey].get(id),
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data[storeKey]
      )
    });

    return this.store.data[storeKey].get(id);
  }

}

module.exports = new BrowseByService();
