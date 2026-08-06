import { LitElement } from 'lit';
import { Mixin, LitCorkUtils } from '@ucd-lib/cork-app-utils';
import render from './app-request-change-modal.tpl.js';
import utils from '../../lib/utils/index.js';

/**
 * @class AppRequestChangeModal
 * @description Modal form that lets an expert request a manual profile change
 * after an automated update fails. Submits via ExpertModel.requestChange which
 * sends a Slack notification to the admin team.
 */
export default class AppRequestChangeModal extends Mixin(LitElement).with(LitCorkUtils) {

  static get properties() {
    return {
      visible: { type: Boolean },
      dagsterDown: { type: Boolean },
      cdlDown: { type: Boolean },
      expertId: { type: String },
      userName: { type: String },
      userEmail: { type: String },
      itemName: { type: String },
      itemSubtext: { type: String },
      itemLabel: { type: String },
      changeType: { type: String },
      searchQuery: { type: String },
      searchLabel: { type: String },
      searchItems: { type: Array },
      searchItemsLoading: { type: Boolean },
      selectedItem: { type: Object },
      initialAvailability: { type: Object },
      collabProjects: { type: Boolean },
      commPartner: { type: Boolean },
      industProjects: { type: Boolean },
      mediaInterviews: { type: Boolean },
      additionalNotes: { type: String },
      submitting: { type: Boolean },
      applying: { type: Boolean },
      submitted: { type: Boolean },
      submitError: { type: Boolean }
    };
  }

  constructor() {
    super();
    this._injectModel('ExpertModel', 'DagsterModel');
    this.render = render.bind(this);
    this._slimSelectColorSheet = null;

    this.visible = false;
    this.dagsterDown = false;
    this.cdlDown = false;
    this.expertId = '';
    this.userName = '';
    this.userEmail = '';
    this.itemName = '';
    this.itemSubtext = '';
    this.itemLabel = 'Item';
    this.changeType = '';
    this.searchQuery = '';
    this.searchLabel = '';
    this.searchItems = [];
    this.searchItemsLoading = false;
    this.selectedItem = null;
    this.initialAvailability = null;
    this.collabProjects = false;
    this.commPartner = false;
    this.industProjects = false;
    this.mediaInterviews = false;
    this.additionalNotes = '';
    this.submitting = false;
    this.applying = false;
    this.submitted = false;
    this.submitError = false;
  }

  /**
   * @method updated
   * @description inject a color override into slim-select's shadow root after each render
   * to match the plain <select> text color (slim-select hardcodes UCD blue internally)
   */
  updated() {
    const slimSelect = this.shadowRoot?.querySelector('ucd-theme-slim-select');
    if( slimSelect?.shadowRoot && !this._slimSelectColorSheet ) {
      this._slimSelectColorSheet = new CSSStyleSheet();
      this._slimSelectColorSheet.replaceSync('.ss-main { color: inherit !important; }');
    }
    if( slimSelect?.shadowRoot && this._slimSelectColorSheet ) {
      const sheets = slimSelect.shadowRoot.adoptedStyleSheets;
      if( !sheets.includes(this._slimSelectColorSheet) ) {
        slimSelect.shadowRoot.adoptedStyleSheets = [...sheets, this._slimSelectColorSheet];
      }
    }
  }

  /**
   * @method _onCancel
   * @description close the modal and reset state
   */
  _onCancel() {
    const shouldReload = this.cdlDown && this.submitted;

    this.additionalNotes = '';
    this.changeType = '';
    this.searchQuery = '';
    this.searchLabel = '';
    this.searchItems = [];
    this.selectedItem = null;
    this.collabProjects = false;
    this.commPartner = false;
    this.industProjects = false;
    this.mediaInterviews = false;
    this.submitted = false;
    this.submitError = false;
    this.dispatchEvent(new CustomEvent('cancel', {}));

    if( shouldReload ) {
      window.location.reload();
    }
  }

  /**
   * @method _onNotesInput
   * @description keep additionalNotes in sync with textarea
   *
   * @param {Event} e
   */
  _onNotesInput(e) {
    this.additionalNotes = e.target.value;
  }

  /**
   * @method _onChangeTypeInput
   * @description update changeType, derive search label, and load items for dagster-down mode
   *
   * @param {Event} e
   */
  async _onChangeTypeInput(e) {
    this.changeType = e.target.value;
    if( !this.dagsterDown ) return;

    const v = this.changeType.toLowerCase();
    const isWork = v.includes('work');
    const isGrant = v.includes('grant');

    if( isWork ) this.searchLabel = 'Which work?';
    else if( isGrant ) this.searchLabel = 'Which grant?';
    else this.searchLabel = '';

    this.searchQuery = '';
    this.searchItems = [];
    this.selectedItem = null;

    if( v.includes('availability') && this.initialAvailability ) {
      this.collabProjects = this.initialAvailability.collabProjects || false;
      this.commPartner = this.initialAvailability.commPartner || false;
      this.industProjects = this.initialAvailability.industProjects || false;
      this.mediaInterviews = this.initialAvailability.mediaInterviews || false;
    }

    if( isWork || isGrant ) {
      await this._loadSearchItems(isWork ? 'work' : 'grant');
    }
  }

  /**
   * @method _loadSearchItems
   * @description fetch all works or grants for this expert to populate the slim-select picker
   *
   * @param {String} type - 'work' or 'grant'
   */
  async _loadSearchItems(type) {
    if( !this.expertId ) return;
    this.searchItemsLoading = true;
    try {
      const subpage = type === 'work' ? '/works-download' : '/grants-download';
      const opts = utils.getExpertApiOptions(
        type === 'work'
          ? { includeGrants: false, worksSize: 10000, includeHidden: true }
          : { includeWorks: false, grantsSize: 10000, includeHidden: true }
      );
      const res = await this.ExpertModel.get(this.expertId, subpage, opts, true);
      const graph = res?.payload?.['@graph'] || [];

      if( type === 'work' ) {
        this.searchItems = graph
          .filter(item => !item['@type']?.includes('Grant'))
          .map(item => {
            const relatedBy = Array.isArray(item.relatedBy) ? item.relatedBy : (item.relatedBy ? [item.relatedBy] : []);
            const rel = relatedBy[0];
            return {
              id: rel?.['@id'] || '',
              label: (Array.isArray(item.title) ? item.title[0] : item.title) || item['container-title'] || ''
            };
          })
          .filter(item => item.id && item.label);
      } else {
        const parsed = utils.parseGrants(this.expertId, graph.filter(g => g['@type']?.includes('Grant')), false);
        this.searchItems = parsed
          .filter(g => g.relationshipId)
          .map(g => ({
            id: g.relationshipId,
            label: (Array.isArray(g.name) ? g.name[0] : g.name) || ''
          }))
          .filter(item => item.label);
      }
    } catch(err) {
      this.searchItems = [];
    } finally {
      this.searchItemsLoading = false;
    }
  }

  /**
   * @method _onSearchChange
   * @description handle slim-select change event; looks up the full item by ID
   *
   * @param {Event} e
   */
  _onSearchChange(e) {
    const id = e.detail?.value || '';
    this.selectedItem = this.searchItems.find(item => item.id === id) || null;
    this.searchQuery = this.selectedItem?.label || '';
  }

  /**
   * @method _onSubmit
   * @description submit the change request; in cdlDown mode applies the change directly
   * and waits for the dagster ES job to complete before advancing to the success screen
   */
  async _onSubmit() {
    this.submitting = true;
    this.submitError = false;

    try {
      const citation = this._buildCitation();

      if( this.cdlDown ) {
        let dagsterRes;
        if( this._isAvailability() ) {
          dagsterRes = await this._applyAvailabilityChange();
        } else {
          dagsterRes = await this._applyChange();
        }

        // Send the slack notification immediately (fire and forget)
        this.ExpertModel.requestChange({
          name: this.userName,
          email: this.userEmail,
          citation,
          changeType: this.changeType,
          notes: this.additionalNotes
        }).catch(() => {});

        // Poll dagster until the ES step reaches a terminal state, then show success
        this.submitting = false;
        this.applying = true;
        await this._pollUntilComplete(dagsterRes);
        this.applying = false;
      } else {
        await this.ExpertModel.requestChange({
          name: this.userName,
          email: this.userEmail,
          citation,
          changeType: this.changeType,
          notes: this.additionalNotes
        });
      }

      this.submitted = true;
    } catch(e) {
      this.applying = false;
      this.submitError = true;
    } finally {
      this.submitting = false;
      this.applying = false;
    }
  }

  /**
   * @method _pollUntilComplete
   * @description poll dagster run status until a terminal state is reached
   *
   * @param {Object} dagsterRes - response from a DagsterModel call containing a runId
   * @returns {Promise<String>} resolves with the terminal status string
   */
  _pollUntilComplete(dagsterRes) {
    return new Promise((resolve) => {
      const runId = dagsterRes?.body?.data?.launchRun?.run?.runId;
      if( !runId ) {
        console.warn('[dagster:cdl-modal] no run ID in response, skipping poll', dagsterRes?.body);
        resolve('UNKNOWN');
        return;
      }

      const terminalStates = ['SUCCESS', 'FAILURE', 'CANCELED'];
      const intervalId = setInterval(async () => {
        try {
          const statusRes = await this.DagsterModel.getLastRunForId(runId);
          const status = statusRes?.body?.data?.runOrError?.status;
          if( terminalStates.includes(status) ) {
            clearInterval(intervalId);
            // CDL is known-down so CDL step failures are expected — always resolve
            resolve(status);
          }
        } catch(err) {
          clearInterval(intervalId);
          resolve('UNKNOWN');
        }
      }, 5000);
    });
  }

  /**
   * @method _isAvailability
   * @description returns true when the selected change type is for availability settings
   *
   * @returns {Boolean}
   */
  _isAvailability() {
    return this.changeType.toLowerCase().includes('availability');
  }

  /**
   * @method _buildCitation
   * @description build the citation string for the slack notification
   *
   * @returns {String}
   */
  _buildCitation() {
    if( this._isAvailability() ) {
      const selected = [];
      if( this.collabProjects ) selected.push('Collaborative Projects');
      if( this.commPartner ) selected.push('Community Partnerships');
      if( this.industProjects ) selected.push('Industry Projects');
      if( this.mediaInterviews ) selected.push('Media Interviews');
      return selected.length ? `Availability: ${selected.join(', ')}` : 'Availability settings';
    }
    if( this.dagsterDown ) return this.selectedItem?.label || this.searchQuery || '';
    return this.itemSubtext ? `${this.itemName}\n${this.itemSubtext}` : this.itemName;
  }

  /**
   * @method _applyAvailabilityChange
   * @description in cdlDown mode, call DagsterModel.updateExpertAvailability with the checked options
   */
  async _applyAvailabilityChange() {
    const openTo = {
      collabProjects: this.collabProjects,
      commPartner: this.commPartner,
      industProjects: this.industProjects,
      mediaInterviews: this.mediaInterviews
    };
    const prevOpenTo = {
      collabProjects: !this.collabProjects,
      commPartner: !this.commPartner,
      industProjects: !this.industProjects,
      mediaInterviews: !this.mediaInterviews
    };
    const labels = utils.buildAvailabilityPayload(openTo, prevOpenTo);
    return this.DagsterModel.updateExpertAvailability(this.expertId, labels);
  }

  /**
   * @method _applyChange
   * @description in cdlDown mode, call the appropriate DagsterModel method to apply the change
   *
   * @returns {Promise<Object>} dagster response containing the runId
   */
  async _applyChange() {
    const v = this.changeType.toLowerCase();
    const id = this.selectedItem?.id;

    if( v.includes('hide a work') && id ) {
      return this.DagsterModel.updateCitationVisibility(this.expertId, id, false);
    } else if( v.includes('show a work') && id ) {
      return this.DagsterModel.updateCitationVisibility(this.expertId, id, true);
    } else if( v.includes('hide a grant') && id ) {
      return this.DagsterModel.updateGrantVisibility(this.expertId, id, false);
    } else if( v.includes('show a grant') && id ) {
      return this.DagsterModel.updateGrantVisibility(this.expertId, id, true);
    } else if( v.includes('hide my profile') ) {
      return this.DagsterModel.updateExpertVisibility(this.expertId, false);
    } else if( v.includes('show my profile') ) {
      return this.DagsterModel.updateExpertVisibility(this.expertId, true);
    } else if( v.includes('remove my profile') ) {
      return this.DagsterModel.deleteExpert(this.expertId);
    }
  }

}

customElements.define('app-request-change-modal', AppRequestChangeModal);
