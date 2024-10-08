import { LitElement } from 'lit';

import {render, styles} from './contributor-row.tpl.js';

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../utils/app-icons.js';

/**
 * @class ContributorRow
 * @description contributor row
 */
export default class ContributorRow extends Mixin(LitElement)
.with(LitCorkUtils) {

  static get properties() {
    return {
      result : { type : Object }
    };
  }

  static get styles() {
    return styles();
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.result = {};
  }

}
customElements.define('app-contributor-row', ContributorRow);
