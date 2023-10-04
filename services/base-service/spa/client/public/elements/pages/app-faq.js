import { LitElement } from 'lit';
import {render} from "./app-faq.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/brand/ucd-theme-list-accordion/ucd-theme-list-accordion.js'

export default class AppFaq extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      isLoggedIn : { type : Boolean },
      imgPath : { type : String },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel');

    this.isLoggedIn = false;
    this.imgPath = '/images/faq/';

    this.render = render.bind(this);
  }

  /**
   * @method _jumpTo
   * @description jump to faq item and open it if closed
   *
   * @param {Object} event
   */
  _jumpTo(e) {
    e.preventDefault();

    // scroll to item
    let jumpToSection = this.shadowRoot.querySelector('ucd-theme-list-accordion li#'+e.currentTarget.dataset.jumpTo);
    if( !jumpToSection ) return;

    let posY = Math.floor(jumpToSection.getBoundingClientRect().top + window.pageYOffset - 10);
    window.scrollTo(0, posY);

    // open item
    let accordion = this.shadowRoot.querySelector('ucd-theme-list-accordion');
    if( !accordion ) return;

    let index = jumpToSection.slot.split('-').pop();
    if( !accordion.itemIsExpanded(index, false) ) {
      accordion.toggleItemVisiblity(index, false, false);
    }
  }

}

customElements.define('app-faq', AppFaq);
