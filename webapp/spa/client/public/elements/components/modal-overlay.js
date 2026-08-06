import { LitElement} from 'lit';

import render from './modal-overlay.tpl.js';

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../utils/app-icons.js';

/**
 * @class ModalOverlay
 * @description modal overlay component
 */
export class ModalOverlay extends LitElement {

  static get properties() {
    return {
      visible : { type : Boolean },
      title : { type : String },
      saveText : { type : String },
      content : { type : String },
      hideCancel : { type : Boolean },
      hideSave : { type : Boolean },
      hideOK : { type : Boolean },
      hideOaPolicyLink : { type : Boolean },
      errorMode : { type : Boolean }
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.visible = false;
    this.title = '';
    this.saveText = '';
    this.content = '';
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = false;
    this.hideOaPolicyLink = false;
    this.errorMode = false;

    window.addEventListener('keydown', (e) => {
      if( !this.visible ) return;

      if( e.key === 'Escape' || e.key === 'Esc') {
        e.stopPropagation();
        this._onCancel();
      }
    });
  }

  /**
   * @method _onCancel
   * @description cancel button event handler
   *
   */
  _onCancel(e) {
    this.dispatchEvent(
      new CustomEvent('cancel', {})
    );
  }

  /**
   * @method _onSave
   * @description save button event handler
   *
   */
  _onSave(e) {
    this.dispatchEvent(
      new CustomEvent('save', {})
    );
  }

  /**
   * @method _onBodyClick
   * @description delegate clicks inside the modal body; dispatches request-change when
   * a .contact-link anchor is clicked so the parent can open the request-change form.
   *
   * @param {Event} e
   */
  _onBodyClick(e) {
    if( e.target.classList.contains('contact-link') ) {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('request-change', { bubbles: true, composed: true }));
    }
  }

}

customElements.define('app-modal-overlay', ModalOverlay);
