const {BaseService} = require('@ucd-lib/cork-app-utils');
const BrowseByStore = require('../stores/BrowseByStore');
const payload = require('../payload.js').default;

class BrowseByService extends BaseService {

  constructor() {
    super();
    this.store = BrowseByStore;

    this.baseUrl = '/api/browse';
  }

  async browseExpertsAZ() {
    let id = 'browseExperts:az';
    let ido = { browseExperts : 'az' };

    await this.request({
      url : this.baseUrl,
      checkCached : () => this.store.data.byExpertsAZ.get(id),
      onLoading : request => this.store.onBrowseExpertsAZUpdate(ido, {request}),
      onLoad : payload => this.store.onBrowseExpertsAZUpdate(ido, {payload: payload.body}),
      onError : error => this.store.onBrowseExpertsAZUpdate(ido, {error})
    });

    return this.store.data.byExpertsAZ.get(id);
  }

  async browseExperts(lastInitial, page=1, size=25) {
    let ido = {lastInitial, page, size};
    let id = payload.getKey(ido);

    await this.request({
      url : this.baseUrl,
      qs : { page, size, p : lastInitial.toUpperCase() },
      checkCached : () => this.store.data.byExpertsLastInitial.get(id),
      onLoading : request => this.store.onBrowseExpertsUpdate(ido, {request}),
      onLoad : payload => this.store.onBrowseExpertsUpdate(ido, {payload: payload.body}),
      onError : error => this.store.onBrowseExpertsUpdate(ido, {error})
    });

    return this.store.data.byExpertsLastInitial.get(id);
  }

}

module.exports = new BrowseByService();
