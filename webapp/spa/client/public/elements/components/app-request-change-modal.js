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
      collabProjects: { type: Boolean },
      commPartner: { type: Boolean },
      industProjects: { type: Boolean },
      mediaInterviews: { type: Boolean },
      additionalNotes: { type: String },
      submitting: { type: Boolean },
      submitted: { type: Boolean },
      submitError: { type: Boolean }
    };
  }

  constructor() {
    super();
    this._injectModel('ExpertModel', 'DagsterModel');
    this.render = render.bind(this);

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
    this.collabProjects = false;
    this.commPartner = false;
    this.industProjects = false;
    this.mediaInterviews = false;
    this.additionalNotes = '';
    this.submitting = false;
    this.submitted = false;
    this.submitError = false;
  }

  /**
   * @method _onCancel
   * @description close the modal and reset state
   */
  _onCancel() {
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
   * @description submit the change request; in cdlDown mode also applies the change directly
   */
  async _onSubmit() {
    this.submitting = true;
    this.submitError = false;

    try {
      if( this.cdlDown && this.selectedItem ) {
        await this._applyChange();
      }
      if( this.cdlDown && this._isAvailability() ) {
        await this._applyAvailabilityChange();
      }

      const citation = this._buildCitation();

      await this.ExpertModel.requestChange({
        name: this.userName,
        email: this.userEmail,
        citation,
        changeType: this.changeType,
        notes: this.additionalNotes
      });
      this.submitted = true;
    } catch(e) {
      this.submitError = true;
    } finally {
      this.submitting = false;
    }
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
    await this.DagsterModel.updateExpertAvailability(this.expertId, labels);
  }

  /**
   * @method _applyChange
   * @description in cdlDown mode, call the appropriate DagsterModel method to apply the change
   */
  async _applyChange() {
    const v = this.changeType.toLowerCase();
    const id = this.selectedItem.id;
    if( v.includes('hide a work') ) {
      await this.DagsterModel.updateCitationVisibility(this.expertId, id, false);
    } else if( v.includes('show a work') ) {
      await this.DagsterModel.updateCitationVisibility(this.expertId, id, true);
    } else if( v.includes('hide a grant') ) {
      await this.DagsterModel.updateGrantVisibility(this.expertId, id, false);
    } else if( v.includes('show a grant') ) {
      await this.DagsterModel.updateGrantVisibility(this.expertId, id, true);
    }
  }

}

customElements.define('app-request-change-modal', AppRequestChangeModal);
