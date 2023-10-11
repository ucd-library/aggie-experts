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
      content : { type : String },
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.visible = false;
    this.title = '';
    this.content = '';

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
   * @description cancel button event handler
   *
   */
  _onSave(e) {
    this.dispatchEvent(
      new CustomEvent('save', {})
    );
  }

}

customElements.define('app-modal-overlay', ModalOverlay);
