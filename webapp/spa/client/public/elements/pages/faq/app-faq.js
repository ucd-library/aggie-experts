import { LitElement } from 'lit';
import {render} from "./app-faq.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

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

    this.isLoggedIn = APP_CONFIG.user?.preferred_username ? true : false;
    this.imgPath = '/images/faq/';

    this.render = render.bind(this);
  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'faq' ) return;

    // jumpTo section if hash in url path
    if( e.location.hash ) {
      requestAnimationFrame(() => this._jumpTo({currentTarget: {dataset: {jumpTo: e.location.hash}}}));
    }
  }

  async updated(changedProperties) {
    if (this.AppStateModel?.location?.page === 'faq' && this.AppStateModel?.location?.hash) {
      this._jumpTo({currentTarget: {dataset: {jumpTo: this.AppStateModel.location.hash}}});
    }
  }

  /**
   * @method _jumpTo
   * @description jump to faq item and open it if closed
   *
   * @param {Object} event
   */
  async _jumpTo(e) {
    if( e.preventDefault ) e.preventDefault();

    // wait for content and child components to render
    await this.updateComplete;
    let childComponents = this.shadowRoot.querySelectorAll('*');
    await Promise.all(Array.from(childComponents).map(async (child) => {
      if( child.updateComplete ) {
        await child.updateComplete;
      }
    }));

    let ignoreAccordions = false;
    let jumpToSection = this.shadowRoot.querySelector('h2#'+e.currentTarget.dataset.jumpTo);
    if( jumpToSection ) ignoreAccordions = true;
    else jumpToSection = this.shadowRoot.querySelector('ucd-theme-list-accordion li#'+e.currentTarget.dataset.jumpTo);

    if( !jumpToSection ) return;

    let posY = Math.floor(jumpToSection.getBoundingClientRect().top + window.pageYOffset - 10);
    window.scrollTo(0, posY);

    if( ignoreAccordions ) return;

    // open item
    let accordions = this.shadowRoot.querySelectorAll('ucd-theme-list-accordion');
    if( !accordions || !accordions.length ) return;

    let index = jumpToSection.slot.split('-').pop();
    accordions.forEach(accordion => {
      if( !accordion.itemIsExpanded(index, false) ) {
        accordion.toggleItemVisiblity(index, false, false);
      }
    });
  }

}

customElements.define('app-faq', AppFaq);
