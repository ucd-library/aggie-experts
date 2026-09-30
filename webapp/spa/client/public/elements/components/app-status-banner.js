import { LitElement } from 'lit';
import render from './app-status-banner.tpl.js';

/**
 * @class AppStatusBanner
 * @description A full-width inline banner for status messages. Supports an
 * error (pink) and info (blue) appearance, an optional leading icon, and an
 * optional dismiss button.
 *
 * Pass structured content via `title`, `titleHref`, and `items`, or use the
 * default slot for custom content.
 *
 * @example
 * <app-status-banner
 *   type="error"
 *   icon="ucdlib-experts:fa-exclamation-triangle"
 *   title="Recent updates to Works failed to save:"
 *   title-href="/expert/abc123/works-edit"
 *   .items="${[{ label: 'My Paper', subtext: 'could not be hidden' }]}"
 *   dismissible
 *   @dismiss=${this._onDismiss}>
 * </app-status-banner>
 */
export default class AppStatusBanner extends LitElement {

  static get properties() {
    return {
      /** @property {String} type - 'error' | 'info' */
      type: { type: String },
      /** @property {String} icon - ucdlib-icon icon attribute value */
      icon: { type: String },
      /** @property {Boolean} dismissible - show the dismiss (×) button */
      dismissible: { type: Boolean },
      /** @property {String} titleLabel - the linked word shown in the title (e.g. "Works") */
      titleLabel: { type: String, attribute: 'title-label' },
      /** @property {String} titleHref - href for the titleLabel link */
      titleHref: { type: String, attribute: 'title-href' },
      /** @property {String} titleSuffix - plain text appended after the label (e.g. "failed to save:") */
      titleSuffix: { type: String, attribute: 'title-suffix' },
      /**
       * @property {Array} items - list of items to display as a bulleted list.
       * Each entry: { label: String, subtext: String }
       */
      items: { type: Array },
      /** @property {String} message - single-line plain text message, used instead of title+items for compact banners */
      message: { type: String },
      /** @property {Boolean} showHelp - render a "get help" link that fires a help event */
      showHelp: { type: Boolean, attribute: 'show-help' }
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);
    this.type = 'info';
    this.icon = '';
    this.dismissible = false;
    this.titleLabel = '';
    this.titleHref = '';
    this.titleSuffix = '';
    this.items = [];
    this.message = '';
    this.showHelp = false;
  }

  /**
   * @method _onDismiss
   * @description dispatch a dismiss event so the parent can remove the banner
   */
  _onDismiss() {
    this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true }));
  }

  /**
   * @method _onHelp
   * @description dispatch a help event so the parent can open the request-change form
   */
  _onHelp(e) {
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('help', { bubbles: true, composed: true }));
  }

}

customElements.define('app-status-banner', AppStatusBanner);
