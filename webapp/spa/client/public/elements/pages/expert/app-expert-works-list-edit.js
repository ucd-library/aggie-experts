import { LitElement } from 'lit';
import {render} from "./app-expert-works-list-edit.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import "@ucd-lib/theme-elements/brand/ucd-theme-collapse/ucd-theme-collapse.js";

import '../../utils/app-icons.js';
import '../../components/modal-overlay.js';
import '../../components/app-toast-popup.js';

import Citation from '../../../lib/utils/citation.js';

import utils from '../../../lib/utils';

export default class AppExpertWorksListEdit extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      expertId : { type : String },
      expert : { type : Object },
      expertName : { type : String },
      citations : { type : Array },
      citationsDisplayed : { type : Array },
      featuredCitations : { type : Array },
      maxFeaturedCitationsIndex : { type : Number },
      totalCitations : { type : Number },
      hiddenCitations : { type : Number },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
      allSelected : { type : Boolean },
      showModal : { type : Boolean },
      hideCancel : { type : Boolean },
      hideSave : { type : Boolean },
      hideOK : { type : Boolean },
      hideOaPolicyLink : { type : Boolean },
      errorMode : { type : Boolean },
      downloads : { type : Array },
      resultsPerPage : { type : Number },
      manageWorksLabel : { type : String },
      worksWithErrors : { type : Array },
      showingAllHighlights : { type : Boolean }
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'ExpertModel');

    this._reset();

    this.render = render.bind(this);
  }

  _reset() {
    this.expertId = '';
    this.expert = {};
    this.expertName = '';
    this.citations = [];
    this.citationsDisplayed = [];
    this.featuredCitations = [];
    this.maxFeaturedCitationsIndex = 10;
    this.totalCitations = 0;
    this.hiddenCitations = 0;
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 25;
    this.allSelected = false;
    this.showModal = false;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = false;
    this.hideOaPolicyLink = false;
    this.errorMode = false;
    this.downloads = [];
    this.isAdmin = (APP_CONFIG.user?.roles || []).includes('admin');
    this.isVisible = true;
    this.manageWorksLabel = 'Manage My Works';
    this.worksWithErrors = [];
    this.showingAllHighlights = false;
    this.modifiedWorks = false;

    let selectAllCheckbox = this.shadowRoot?.querySelector('#select-all');
    if( selectAllCheckbox ) selectAllCheckbox.checked = false;
  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  willUpdate() {
    // hack, pagination links too wide
    let pagination = this.shadowRoot.querySelector('ucd-theme-pagination');
    if( !pagination ) return;

    let pageLinks = pagination.shadowRoot.querySelectorAll('.pager__item a') || [];
    pageLinks.forEach(link => {
      link.style.padding = '0.25rem';
    });
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'works-edit' ) {
      this._reset();
      return;
    }

    // parse /page/size from url, or append if trying to access /works-edit
    let page = e.location.pathname.split('/works-edit/')?.[1];
    if( page ) {
      let parts = page.split('/');
      this.currentPage = Number(parts?.[0] || 1);
      this.resultsPerPage = Number(parts?.[1] || 25);
    }


    let expertId = e.location.path[0]+'/'+e.location.path[1]; // e.location.pathname.replace('/works-edit', '');
    if( expertId.substr(0,1) === '/' ) expertId = expertId.substr(1);

    let canEdit = (APP_CONFIG.user?.expertId === expertId || utils.getCookie('editingExpertId') === expertId);

    if( !expertId || !canEdit ) this.dispatchEvent(new CustomEvent("show-404", {}));

    try {
      let expert = await this.ExpertModel.get(
        expertId,
        `/works-edit?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
        utils.getExpertApiOptions({
          includeGrants : false,
          worksPage : this.currentPage,
          worksSize : this.resultsPerPage,
          includeHidden : true,
          includeWorksMisformatted : true,
          // favouriteWorksFirst : true
          favouritesPlusFirstPageWorks : this.currentPage === 1,
          // shown only on the top of the first page,
          // otherwise, not shown in normal list of works on other pages
        }),
        this.isAdmin // clear cache if modified works
      );
      this.modifiedWorks = false;

      if( expert.state === 'error' || (!this.isAdmin && !this.isVisible) ) throw new Error();

      this._onExpertUpdate(expert);
    } catch (error) {
      this.logger.warn('expert ' + expertId + ' not found, throwing 404');

      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
    }
  }

  /**
   * @method _onExpertUpdate
   * @description bound to ExpertModel expert-update event
   *
   * @return {Object} e
   */
  async _onExpertUpdate(e) {
    if( e?.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'works-edit' ) return;
    if( e.id.includes('/works-download') ) return;

    this.expertId = e.expertId;
    this.expert = JSON.parse(JSON.stringify(e.payload));
    this.isVisible = this.expert['is-visible'];

    let graphRoot = (this.expert['@graph'] || []).filter(item => item['@id'] === this.expertId)[0];
    this.expertName = graphRoot.hasName?.given + (graphRoot.hasName?.middle ? ' ' + graphRoot.hasName.middle : '') + ' ' + graphRoot.hasName?.family;

    this.hiddenCitations = this.expert?.totals?.hiddenWorks || 0;
    this.totalCitations = (this.expert?.totals?.works || 0);

    this._updateHeaderLabels();

    this.worksWithErrors = this.expert.invalidWorks || [];
    if( this.worksWithErrors.length ) this.logger.error('works with errors', { expertId : this.expertId, worksWithErrors : this.worksWithErrors });

    this.worksWithErrors.forEach(work => {
      if( Array.isArray(work.issued) ) work.issued = work.issued[0];
    });

    this.worksWithErrors.sort((a, b) => {
      if( typeof a.issued !== 'string' ) a.issued = 'Date Unknown';
      if( typeof b.issued !== 'string' ) b.issued = 'Date Unknown';

      // sort issued descending
      let issuedA = a.issued?.split('-')?.[0] === 'Date Unknown' ? -Infinity : Number(a.issued?.split('-')?.[0]);
      let issuedB = b.issued?.split('-')?.[0] === 'Date Unknown' ? -Infinity : Number(b.issued?.split('-')?.[0]);

      if (issuedA !== issuedB) {
        return issuedB - issuedA;
      }

      return a.title.localeCompare(b.title);
    });

    // only expert graph record, no works for this pagination of results
    if( this.expert['@graph'].length === 1 ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    }

    await this._loadCitations();
  }

  /**
   * @method _loadCitations
   * @description load citations for expert async
   *
   * @param {Boolean} all load all citations, not just first 25, used for downloading all citations
   * @param {Object} apiResponse optional response from ExpertModel.get
   * @param {Boolean} isDownload whether loading citations for download
   */
  async _loadCitations(all=false, apiResponse={}, isDownload=false) {
    let citations = all ? JSON.parse(JSON.stringify((apiResponse['@graph'] || []).filter(g => g.issued))) : JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g.issued)));

    citations = citations.map(c => {
      let citation = { ...c };
      citation.title = Array.isArray(citation.title) ? citation.title.join(' | ') : citation.title;
      return citation;
    });

    if( !all && !isDownload ) this.citations = citations;

    let citationResults = await Citation.generateCitations(citations);
    citationResults = citationResults.map(c => c.value || c.reason?.data);

    // this.featuredCitations
    let featuredCitations = citationResults.filter(c => c.relatedBy && Array.isArray(c.relatedBy)
        ? c.relatedBy.some(rel => rel['ucdlib:favourite'] === true)
        : c.relatedBy && c.relatedBy['ucdlib:favourite'] === true
      );

    if( featuredCitations.length ) {
      // ensure sorted by year descending
      featuredCitations.sort((a, b) => {
        let aYear = Array.isArray(a.issued) ? a.issued[0] : a.issued.split('-')[0];
        let bYear = Array.isArray(b.issued) ? b.issued[0] : b.issued.split('-')[0];
        return bYear - aYear;
      });

      citationResults.sort((a, b) => {
        let aYear = Array.isArray(a.issued) ? a.issued[0] : a.issued.split('-')[0];
        let bYear = Array.isArray(b.issued) ? b.issued[0] : b.issued.split('-')[0];
        return bYear - aYear;
      });

      featuredCitations.forEach(cite => {
        if( Array.isArray(cite['container-title']) ) cite['container-title'] = cite['container-title'][0];
        cite['is-visible'] = (cite.relatedBy.some(related => related['is-visible'] && related?.relates?.some(r => r === this.expertId)));
        if( cite.relatedBy && Array.isArray(cite.relatedBy) ) {
          cite.favourite = cite.relatedBy.some(rel => rel['ucdlib:favourite'] === true);
        } else {
          cite.favourite = cite.relatedBy && cite.relatedBy['ucdlib:favourite'] === true;
        }
      });
    }

    // also remove issued date from citations if not first displayed on page from that year
    citationResults = this._updateCitationsDisplayedDates(citationResults);

    // make sure container-title is a single string, and update visibility
    citationResults.forEach(cite => {
      if( Array.isArray(cite['container-title']) ) cite['container-title'] = cite['container-title'][0];
      cite['is-visible'] = (cite.relatedBy.some(related => related['is-visible'] && related?.relates?.some(r => r === this.expertId)));
      if( cite.relatedBy && Array.isArray(cite.relatedBy) ) {
        cite.favourite = cite.relatedBy.some(rel => rel['ucdlib:favourite'] === true);
      } else {
        cite.favourite = cite.relatedBy && cite.relatedBy['ucdlib:favourite'] === true;
      }
    });

    this.paginationTotal = Math.ceil(this.totalCitations / this.resultsPerPage);

    // also dedupe results (featured citations may be in normal list too)
    citationResults = citationResults.filter((cite, index, self) => index === self.findIndex((c) => (c['@id'] === cite['@id'])));
    featuredCitations = featuredCitations.filter((cite, index, self) => index === self.findIndex((c) => (c['@id'] === cite['@id'])));

    if( all || isDownload ) return citationResults;

    this.citationsDisplayed = citationResults;
    this.featuredCitations = featuredCitations;

    // hack to hide inner content of collapsed rows on first load, to remove extra white space
    requestAnimationFrame(() => {
      const wrappers = Array.from(this.renderRoot?.querySelectorAll('.row-wrapper') || []);
      wrappers.forEach(w => {
        const idx = Number(w.dataset.index || -1);
        // keep first 5 always visible; hide others if not showingAllHighlights
        if (idx > 4 && !this.showingAllHighlights) {
          const content = w.firstElementChild;
          if (content) content.style.display = 'none';
          w.classList.add('collapsed');
        }
      });
    });

    this._updateMaxCitationsIndex();
    this.requestUpdate();
  }

  _updateMaxCitationsIndex() {
    // need to get index of the last featured citation in the displayed citations
    // to show disclaimer if more than 10 featured citations are visible
    let visibleCount = 0;
    this.maxFeaturedCitationsIndex = this.featuredCitations.findIndex(c => c['is-visible'] && ++visibleCount === 10) + 1;
    if( this.maxFeaturedCitationsIndex < 10 ) this.maxFeaturedCitationsIndex = 10;
  }

  /**
   * @method _toggleShowAllHighlights
   * @description toggle showing all highlights in the list, and animate the expand/collapse
   * @param {Object} e click|keyup event
   */
  _toggleShowAllHighlights(e) {
    let willShow = !this.showingAllHighlights;
    const wrappers = Array.from(this.renderRoot.querySelectorAll('.row-wrapper'));

    // expand/collapse animation
    if( willShow ) {
      // expand
      wrappers.forEach(w => {
        const idx = Number(w.dataset.index || -1);
        if (idx <= 4) return; // keep first 5 always visible

        // Ensure inner content is rendered and visible before measuring
        const content = w.firstElementChild;
        if (content) content.style.display = '';

        // expand: remove collapsed state then animate from 0 -> measured height
        w.classList.remove('collapsed');
        w.style.height = '0px';
        void w.offsetHeight;
        const target = content ? (content.scrollHeight || content.getBoundingClientRect().height) : w.scrollHeight;
        w.style.height = target + 'px';

        const onEnd = (ev) => {
          if (ev.target !== w) return;
          // clear inline height so layout is natural
          w.style.height = '';
          // make sure inner content stays visible
          if (content) content.style.display = '';
          w.removeEventListener('transitionend', onEnd);
        };
        w.addEventListener('transitionend', onEnd);
      });
    } else {
      // collapse
      wrappers.forEach(w => {
        const idx = Number(w.dataset.index || -1);
        if (idx <= 4) return;

        const content = w.firstElementChild;
        // measure current height (content must be visible to measure)
        if (content && getComputedStyle(content).display === 'none') {
          content.style.display = '';
        }
        const start = content ? (content.getBoundingClientRect().height) : w.scrollHeight;
        w.style.height = start + 'px';
        void w.offsetHeight;
        // animate to zero height
        w.style.height = '0px';

        const onEnd = (ev) => {
          if (ev.target !== w) return;
          // hide inner content to remove any residual white space
          if (content) content.style.display = 'none';
          w.classList.add('collapsed');
          w.style.height = '';
          w.removeEventListener('transitionend', onEnd);
        };
        w.addEventListener('transitionend', onEnd);
      });
    }

    this.showingAllHighlights = willShow;
  }

  /**
   * @method _onPaginationChange
   * @description bound to click events of the pagination element
   *
   * @param {Object} e click|keyup event
   */
  async _onPaginationChange(e) {
    this.allSelected = false;
    e.detail.startIndex = e.detail.page * this.resultsPerPage - this.resultsPerPage;
    let maxIndex = e.detail.page * (e.detail.startIndex || this.resultsPerPage);
    if( maxIndex > this.totalCitations ) maxIndex = this.totalCitations;

    this.currentPage = e.detail.page;

    let path = '/'+this.expertId+'/works-edit';
    if( this.currentPage > 1 || this.resultsPerPage !== 25 ) path += '/'+this.currentPage;
    if( this.resultsPerPage !== 25 ) path += '/'+this.resultsPerPage;
    this.AppStateModel.setLocation(path);

    let expert = await this.ExpertModel.get(
      this.expertId,
      `/works-edit?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
      utils.getExpertApiOptions({
        includeGrants : false,
        worksPage : this.currentPage,
        worksSize : this.resultsPerPage,
        includeHidden : true,
        includeWorksMisformatted : true
      }),
      this.isAdmin
    );
    await this._onExpertUpdate(expert);

    requestAnimationFrame(() => {
      // loop over checkboxes to see if any are checked
      let rows = this.shadowRoot.querySelectorAll('edit-work-result-row') || [];
      rows.forEach(row => {
        let checkbox = row.shadowRoot.querySelector('.select-checkbox input[type="checkbox"]');
        if( this.downloads.includes(checkbox?.dataset?.id) ) {
          checkbox.checked = true;
        } else {
          checkbox.checked = false;
          this.allSelected = false;
        }
      });

      let selectAllCheckbox = this.shadowRoot.querySelector('#select-all');
      if( selectAllCheckbox && !this.allSelected ) {
        selectAllCheckbox.checked = false;
      } else if( selectAllCheckbox ) {
        selectAllCheckbox.checked = true;
      }
    });

    this.dispatchEvent(
      new CustomEvent("reset-scroll", {
        bubbles : true,
        cancelable : true,
      })
    );
  }

  /**
   * @method _selectAllChecked
   * @description bound to click events of Select All checkbox
   *
   * @param {Object} e click|keyup event
   */
  _selectAllChecked(e) {
    this.allSelected = e.currentTarget.checked;
    let rows = this.shadowRoot.querySelectorAll('edit-work-result-row') || [];
    rows.forEach(row => {
      let checkbox = row.shadowRoot.querySelector('.select-checkbox input[type="checkbox"]');
      if( checkbox ) {
        checkbox.checked = this.allSelected;
        let id = checkbox.dataset.id;

        if( this.allSelected ) {
          if( !this.downloads.includes(id) ) this.downloads.push(id);
        } else {
          this.downloads = this.downloads.filter(d => d !== id);
        }
      }
    });
  }

  /**
   * @method _selectAllChecked
   * @description bound to click events of Select checkboxes
   *
   * @param {Object} e click|keyup event
   */
  _selectChecked(e) {
    let id = e.detail.citationId;

    if( e.currentTarget.checked || e.detail.checked ) {
      this.downloads.push(id);
    } else {
      this.downloads = this.downloads.filter(d => d !== id);
      this.allSelected = false;
      let selectAllCheckbox = this.shadowRoot.querySelector('#select-all');
      if( selectAllCheckbox ) {
        selectAllCheckbox.checked = false;
      }
    }
  }

  /**
   * @method _downloadClicked
   * @description bound to click events of download button
   *
   * @param {Object} e click|keyup event
   */
  async _downloadClicked(e) {
    e.preventDefault();

    let res = await this.ExpertModel.get(
      this.expertId,
      '/works-download', // subpage
      utils.getExpertApiOptions({
        includeGrants : false,
        worksSize : 10000,
        includeHidden : true
      }),
      true
    );

    let allCitations = await this._loadCitations(true, res.payload, true);
    let downloads = allCitations.filter(c => this.downloads.includes(c['@id']));

    let text = downloads.map(c => c.ris).join('\n');
    let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    let url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'works.ris');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if( window.gtag ) gtag('event', 'citation_download', {});
    this.logger.info('citations downloaded for expert', { expertId : this.expertId, ris : text });
  }

  /**
   * @method _hideWork
   * @description show modal with link to hide work
   */
  _hideWork(e) {
    this.citationId = e.detail.citationId;

    this.modalTitle = 'Hide Work';
    this.modalContent = `<p>This record will be <strong>hidden from your profile</strong> and marked as "Internal" in the UC Publication Management System.</p><p>Are you sure you want to hide this work?</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  /**
   * @method _showWork
   * @description show work
   */
  async _showWork(e) {
    this.citationId = e.detail.citationId;
    this.dispatchEvent(new CustomEvent("loading", {}));

    try {
      let res = await this.ExpertModel.updateCitationVisibility(this.expertId, this.citationId, true);
      setTimeout(() => {
        // sync to elastic/indexing sometimes delays a couple seconds, add spinner to prevent confusion
        this.dispatchEvent(new CustomEvent("loaded", {}));

        let toastPopup = this.shadowRoot.querySelector('app-toast-popup');
        if( toastPopup ) toastPopup.showPopup('Showing on Profile');
      }, 1500);

      if( window.gtag ) {
        gtag('event', 'citation_is_visible', {
          'description': 'citation ' + this.citationId + ' shown for expert ' + this.expertId,
          'relationshipId': this.citationId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
      this.logger.info('setting citation to be visible', { citationId : this.citationId, expertId : this.expertId });
    } catch (error) {
      this.dispatchEvent(new CustomEvent("loaded", {}));

      let citationTitle = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)?.[0]?.title || '';
      let modelContent = `
        <p>
          <strong>${citationTitle}</strong> could not be updated. Please try again later or make your changes directly in the
          <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=1&tids=5&ipr=true" target="_blank">UC Publication Management System (opens in new tab).</a>
        </p>
        <p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>
      `;

      this.modalTitle = 'Error: Update Failed';
      this.modalContent = modelContent;
      this.showModal = true;
      this.hideCancel = true;
      this.hideSave = true;
      this.hideOK = false;
      this.hideOaPolicyLink = true;
      this.errorMode = true;

      if( window.gtag ) {
        gtag('event', 'citation_is_visible', {
          'description': 'attempted to show citation ' + this.citationId + ' for expert ' + this.expertId + ' but failed',
          'relationshipId': this.citationId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
      this.logger.error('failed to set citation to be visible', { citationId : this.citationId, expertId : this.expertId });

      return;
    }

    // update graph/display data
    let citation = this.citationsDisplayed.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['is-visible'] = true;
      citation['is-visible'] = true;
    }
    citation = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['is-visible'] = true;
      citation['is-visible'] = true;
    }
    citation = (this.expert['@graph'] || []).filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['is-visible'] = true;
      citation['is-visible'] = true;
    }

    this.hiddenCitations--;
    this._updateHeaderLabels();

    this.modifiedWorks = true;

    this.citationsDisplayed = JSON.parse(JSON.stringify(this.citationsDisplayed));
    this.requestUpdate();
  }

  /**
   * @method _deselectFavourite
   * @description remove favourite from work
   */
  async _deselectFavourite(e) {
    this.citationId = e.detail.citationId;
    this.dispatchEvent(new CustomEvent("loading", {}));

    try {
      let res = await this.ExpertModel.updateCitationFavourite(this.expertId, this.citationId, false);
      setTimeout(() => {
        // sync to elastic/indexing sometimes delays a couple seconds, add spinner to prevent confusion
        this.dispatchEvent(new CustomEvent("loaded", {}));

        let toastPopup = this.shadowRoot.querySelector('app-toast-popup');
        if( toastPopup ) toastPopup.showPopup('Removed from Highlights');
      }, 1500);

      if( window.gtag ) {
        gtag('event', 'citation_is_favourite', {
          'description': 'citation ' + this.citationId + ' removed as favourite for expert ' + this.expertId,
          'relationshipId': this.citationId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
      this.logger.info('removing citation as favourite', { citationId : this.citationId, expertId : this.expertId });
    } catch (error) {
      this.dispatchEvent(new CustomEvent("loaded", {}));

      let citationTitle = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)?.[0]?.title || '';
      let modelContent = `
        <p>
          <strong>${citationTitle}</strong> could not be updated. Please try again later or make your changes directly in the
          <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=1&tids=5&ipr=true" target="_blank">UC Publication Management System (opens in new tab).</a>
        </p>
        <p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>
      `;

      this.modalTitle = 'Error: Update Failed';
      this.modalContent = modelContent;
      this.showModal = true;
      this.hideCancel = true;
      this.hideSave = true;
      this.hideOK = false;
      this.hideOaPolicyLink = true;
      this.errorMode = true;

      if( window.gtag ) {
        gtag('event', 'citation_is_favourite', {
          'description': 'attempted to remove favourite on citation ' + this.citationId + ' for expert ' + this.expertId + ' but failed',
          'relationshipId': this.citationId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
      this.logger.error('failed to remove citation as favourite', { citationId : this.citationId, expertId : this.expertId });

      return;
    }

    // update graph/display data
    let citation = this.citationsDisplayed.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['ucdlib:favourite'] = false;
      citation.favourite = false;
    }
    citation = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['ucdlib:favourite'] = false;
      citation.favourite = false;
    }
    citation = (this.expert['@graph'] || []).filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['ucdlib:favourite'] = false;
      citation.favourite = false;
    }
    citation = this.featuredCitations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['ucdlib:favourite'] = false;
      citation.favourite = false;

      // update featured citations list
      this.featuredCitations = this.featuredCitations.filter(c => c.relatedBy?.[0]?.['@id'] !== this.citationId);

      this._reSortCitations();
    }

    this._updateMaxCitationsIndex();

    this._updateHeaderLabels();

    this.modifiedWorks = true;

    this.citationsDisplayed = JSON.parse(JSON.stringify(this.citationsDisplayed));
    this.requestUpdate();
  }

  /**
   * @method _markFavourite
   * @description add favourite to work
   */
  async _markFavourite(e) {
    this.citationId = e.detail.citationId;
    this.dispatchEvent(new CustomEvent("loading", {}));

    try {
      let res = await this.ExpertModel.updateCitationFavourite(this.expertId, this.citationId, true);
      setTimeout(() => {
        // sync to elastic/indexing sometimes delays a couple seconds, add spinner to prevent confusion
        this.dispatchEvent(new CustomEvent("loaded", {}));

        let toastPopup = this.shadowRoot.querySelector('app-toast-popup');
        if( toastPopup ) toastPopup.showPopup('Added to Highlights');
      }, 1500);

      if( window.gtag ) {
        gtag('event', 'citation_is_favourite', {
          'description': 'citation ' + this.citationId + ' added as favourite for expert ' + this.expertId,
          'relationshipId': this.citationId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
      this.logger.info('adding citation as favourite', { citationId : this.citationId, expertId : this.expertId });
    } catch (error) {
      this.dispatchEvent(new CustomEvent("loaded", {}));

      let citationTitle = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)?.[0]?.title || '';
      let modelContent = `
        <p>
          <strong>${citationTitle}</strong> could not be updated. Please try again later or make your changes directly in the
          <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=1&tids=5&ipr=true" target="_blank">UC Publication Management System (opens in new tab).</a>
        </p>
        <p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>
      `;

      this.modalTitle = 'Error: Update Failed';
      this.modalContent = modelContent;
      this.showModal = true;
      this.hideCancel = true;
      this.hideSave = true;
      this.hideOK = false;
      this.hideOaPolicyLink = true;
      this.errorMode = true;

      if( window.gtag ) {
        gtag('event', 'citation_is_favourite', {
          'description': 'attempted to add favourite on citation ' + this.citationId + ' for expert ' + this.expertId + ' but failed',
          'relationshipId': this.citationId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
      this.logger.error('failed to add citation as favourite', { citationId : this.citationId, expertId : this.expertId });

      return;
    }

    // update graph/display data
    let citation = this.citationsDisplayed.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['ucdlib:favourite'] = true;
      citation.favourite = true;
    }
    citation = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['ucdlib:favourite'] = true;
      citation.favourite = true;
    }
    citation = (this.expert['@graph'] || []).filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      citation.relatedBy[0]['ucdlib:favourite'] = true;
      citation.favourite = true;
    }

    // update featured citations list
    citation = this.citationsDisplayed.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
    if( citation ) {
      this.featuredCitations.push(citation);

      this._reSortCitations();
    }

    this._updateMaxCitationsIndex();

    this._updateHeaderLabels();

    this.modifiedWorks = true;

    this.citationsDisplayed = JSON.parse(JSON.stringify(this.citationsDisplayed));
    this.requestUpdate();
  }

  /**
   * @method _reSortCitations
   * @description resort displayed/featured citations
   */
  _reSortCitations() {
    this.citationsDisplayed.sort((a, b) => {
      let aYear = Array.isArray(a.originalIssued) ? a.originalIssued[0] : a.originalIssued?.split('-')?.[0];
      let bYear = Array.isArray(b.originalIssued) ? b.originalIssued[0] : b.originalIssued?.split('-')?.[0];
      return bYear - aYear;
    });
    this.featuredCitations.sort((a, b) => {
      let aYear = Array.isArray(a.originalIssued) ? a.originalIssued[0] : a.originalIssued?.split('-')?.[0];
      let bYear = Array.isArray(b.originalIssued) ? b.originalIssued[0] : b.originalIssued?.split('-')?.[0];
      return bYear - aYear;
    });
  }

  _updateCitationsDisplayedDates(citationResults) {
    let citations = citationResults || this.citationsDisplayed;

    (citations || []).forEach(cite => {
      if( !cite.issued && cite.originalIssued ) cite.issued = cite.originalIssued;
    });

    let lastPrintedYear;
    (citations || []).forEach((cite, i) => {
      if( !Array.isArray(cite.issued) ) cite.issued = cite.issued.split('-');
      cite.originalIssued = cite.issued;
      let newIssueDate = cite.issued?.[0];
      if( i > 0 && ( newIssueDate === citations[i-1].issued?.[0] || lastPrintedYear === newIssueDate ) && i % this.resultsPerPage !== 0 ) {
        delete cite.issued;
        lastPrintedYear = newIssueDate;
      }
    });

    return citations;
  }

  /**
   * @method _modalSave
   * @description modal save event
   */
  async _modalSave(e) {
    e.preventDefault();

    this.dispatchEvent(new CustomEvent("loading", {}));

    this.showModal = false;
    let action = e.currentTarget.title.trim() === 'Hide Work' ? 'hide' : 'reject';

    if( action === 'hide' ) {
      try {
        let res = await this.ExpertModel.updateCitationVisibility(this.expertId, this.citationId, false);
        setTimeout(() => {
          // sync to elastic/indexing sometimes delays a couple seconds, add spinner to prevent confusion
          this.dispatchEvent(new CustomEvent("loaded", {}));

          let toastPopup = this.shadowRoot.querySelector('app-toast-popup');
          if( toastPopup ) toastPopup.showPopup('Hidden from Profile');
        }, 1500);

        if( window.gtag ) {
          gtag('event', 'citation_is_visible', {
            'description': 'citation ' + this.citationId + ' hidden for expert ' + this.expertId,
            'relationshipId': this.citationId,
            'expertId': this.expertId,
            'fatal': false
          });
        }
        this.logger.info('setting citation to be hidden', { citationId : this.citationId, expertId : this.expertId });
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));

        let citationTitle = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)?.[0]?.title || '';
        let modelContent = `
          <p>
            <strong>${citationTitle}</strong> could not be updated. Please try again later or make your changes directly in the
            <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=1&tids=5&ipr=true" target="_blank">UC Publication Management System (opens in new tab).</a>
          </p>
          <p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>
        `;

        this.modalTitle = 'Error: Update Failed';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'citation_is_visible', {
            'description': 'attempted to hide citation ' + this.citationId + ' for expert ' + this.expertId + ' but failed',
            'relationshipId': this.citationId,
            'expertId': this.expertId,
            'fatal': false
          });
        }
        this.logger.error('failed to set citation to be hidden', { citationId : this.citationId, expertId : this.expertId });
        return;
      }

      // update graph/display data
      let citation = this.citationsDisplayed.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
      if( citation ) {
        citation.relatedBy[0]['is-visible'] = false;
        citation['is-visible'] = false;
      }
      citation = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
      if( citation ) {
        citation.relatedBy[0]['is-visible'] = false;
        citation['is-visible'] = false;
      }
      citation = (this.expert['@graph'] || []).filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)[0];
      if( citation ) {
        citation.relatedBy[0]['is-visible'] = false;
        citation['is-visible'] = false;
      }
      this.hiddenCitations++;

      this._updateHeaderLabels();

      this.modifiedWorks = true;

      this.citationsDisplayed = JSON.parse(JSON.stringify(this.citationsDisplayed));
      this.requestUpdate();
      return;
    } else if ( action === 'reject' ) {
      try {
        let res = await this.ExpertModel.rejectCitation(this.expertId, this.citationId);
        setTimeout(() => {
          // sync to elastic/indexing sometimes delays a couple seconds, add spinner to prevent confusion
          this.dispatchEvent(new CustomEvent("loaded", {}));

          let toastPopup = this.shadowRoot.querySelector('app-toast-popup');
          if( toastPopup ) toastPopup.showPopup('Removed from Profile');
        }, 1500);

        if( window.gtag ) {
          gtag('event', 'citation_reject', {
            'description': 'citation ' + this.citationId + ' rejected for expert ' + this.expertId,
            'relationshipId': this.citationId,
            'expertId': this.expertId,
            'fatal': false
          });
        }
        this.logger.info('setting citation to be rejected', { citationId : this.citationId, expertId : this.expertId });

      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));

        let citationTitle = this.citations.filter(c => c.relatedBy?.[0]?.['@id'] === this.citationId)?.[0]?.title || '';
        let modelContent = `
          <p>
            <strong>${citationTitle}</strong> could not be updated. Please try again later or make your changes directly in the
            <a href="https://oapolicy.universityofcalifornia.edu/" target="_blank">UC Publication Management System (opens in new tab).</a>
          </p>
          <p>For more help, see <a href="/faq#reject-publication">troubleshooting tips.</a></p>
        `;

        this.modalTitle = 'Error: Update Failed';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'citation_reject', {
            'description': 'attempted to reject citation ' + this.citationId + ' for expert ' + this.expertId + ' but failed',
            'relationshipId': this.citationId,
            'expertId': this.expertId,
            'fatal': false
          });
        }
        this.logger.error('failed to set citation to be rejected', { citationId : this.citationId, expertId : this.expertId });

      }
    }

    this.modifiedWorks = true;

    let expert = await this.ExpertModel.get(
      this.expertId,
      `/works-edit?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
      utils.getExpertApiOptions({
        includeGrants : false,
        worksPage : this.currentPage,
        worksSize : this.resultsPerPage,
        includeHidden : true,
        includeWorksMisformatted : true
      }),
      true // clear cache
    );
    this._onExpertUpdate(expert);
  }

  /**
   * @method _rejectWork
   * @description show modal with link to reject work
   */
  _rejectWork(e) {
    this.citationId = e.detail.citationId;

    this.modalTitle = 'Reject Work';
    this.modalContent = `<p>This record will be <strong>permanently removed</strong> from your Aggie Experts profile. To reclaim this item, you must do so via the UC Publication Management System.</p><p>Are you sure you want to reject this work?</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  _updateHeaderLabels() {
    if( this.hiddenCitations === 0 ) {
      this.manageWorksLabel = `Manage My Works (${this.totalCitations})`;
    } else {
      this.manageWorksLabel = `Manage My Works (${this.totalCitations - this.hiddenCitations} Public, ${this.hiddenCitations} Hidden)`;
    }
  }

  /**
   * @method _addNewWorkClicked
   * @description show modal with link to add work
   */
  _addNewWorkClicked(e) {
    e.preventDefault();
    // this.AppStateModel.setLocation('/works-add/'+this.expertId);
    this.modalTitle = 'Add New Work';
    this.modalContent = `<p>New works are added, claimed or rejected via the <strong>UC Publication Management System.</strong></p><p>You will be redirected to this system.</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = true;
    this.hideOK = true;
    this.hideOaPolicyLink = false;
    this.errorMode = false;
  }

  /**
   * @method _returnToProfile
   * @description return to /expert/<id> page
   *
   * @return {Object} e
   */
  _returnToProfile(e) {
    e.preventDefault();

    // reset data to first page of results
    this.currentPage = 1;

    this.AppStateModel.setLocation('/'+this.expertId);
    this.AppStateModel.set({ modifiedWorks : this.modifiedWorks });
  }

}

customElements.define('app-expert-works-list-edit', AppExpertWorksListEdit);
