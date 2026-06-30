import { LitElement } from 'lit';
import { Mixin, LitCorkUtils } from '@ucd-lib/cork-app-utils';
import render from './app-request-change-modal.tpl.js';

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
      userName: { type: String },
      userEmail: { type: String },
      itemName: { type: String },
      itemSubtext: { type: String },
      itemLabel: { type: String },
      changeType: { type: String },
      additionalNotes: { type: String },
      submitting: { type: Boolean },
      submitted: { type: Boolean },
      submitError: { type: Boolean }
    };
  }

  constructor() {
    super();
    this._injectModel('ExpertModel');
    this.render = render.bind(this);

    this.visible = false;
    this.userName = '';
    this.userEmail = '';
    this.itemName = '';
    this.itemSubtext = '';
    this.itemLabel = 'Item';
    this.changeType = '';
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
   * @description allow user to alter the pre-selected change type
   *
   * @param {Event} e
   */
  _onChangeTypeInput(e) {
    this.changeType = e.target.value;
  }

  /**
   * @method _onSubmit
   * @description submit the change request via ExpertModel
   */
  async _onSubmit() {
    this.submitting = true;
    this.submitError = false;

    try {
      const citation = this.itemSubtext
        ? `${this.itemName}\n${this.itemSubtext}`
        : this.itemName;
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

}

customElements.define('app-request-change-modal', AppRequestChangeModal);
