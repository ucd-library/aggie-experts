import { html } from 'lit';

import { sharedStyles } from '../styles/shared-styles';

export default function render() {
  return html`

<style include="shared-styles">
  ${sharedStyles}

  :host {
    display: inline-block;
    position: fixed;
  }

  [hidden] { display: none !important; }

  #popup {
    display: block;
    z-index: 10;
    background: var(--color-aggie-blue-10);
    padding: 1rem;
    position: fixed;
    bottom: 1rem;
    right: calc(50% - 110px - 2rem);
    font-size: 1rem;
    margin: 1rem;
    border-radius: 1.5rem;
    box-shadow: 0px 3px 6px #00000029;
    transition: all 0.3s;
    color: var(--color-aggie-blue);
  }

  #popup svg {
    height: 20px;
    width: 30px;
    fill: var(--color-sage);
    position: relative;
    top: 0.2rem;
  }
</style>

<div id="popup" ?hidden="${!this.visible}">
  <svg id="fa-check" height="1em" viewBox="0 0 448 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>
  ${this.message}
</div>

`;}
