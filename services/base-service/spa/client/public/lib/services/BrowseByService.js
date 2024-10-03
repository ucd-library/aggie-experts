const {BaseService} = require('@ucd-lib/cork-app-utils');
const BrowseByStore = require('../stores/BrowseByStore');
const payloadUtils = require('../payload.js').default;

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
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data.byExpertsAZ
      )
    });

    return this.store.data.byExpertsAZ.get(id);
  }

  async browseExperts(lastInitial, page=1, size=25) {
    let ido = {lastInitial, page, size};
    let id = payloadUtils.getKey(ido);

    await this.request({
      url : this.baseUrl,
      qs : { page, size, p : lastInitial.toUpperCase() },
      checkCached : () => this.store.data.byExpertsLastInitial.get(id),
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data.byExpertsLastInitial
      )
    });

    return this.store.data.byExpertsLastInitial.get(id);
  }

}

module.exports = new BrowseByService();
