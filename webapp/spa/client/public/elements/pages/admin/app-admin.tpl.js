import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

import layoutCss from '@ucd-lib/theme-sass/5_layout/_index.css';
import listsCss from '@ucd-lib/theme-sass/2_base_class/_lists.css';
import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";

import '@ucd-lib/theme-elements/brand/ucd-theme-slim-select/ucd-theme-slim-select.js'


export function render() {
return html`
  <style>
    ${sharedStyles}
    ${layoutCss}
    ${listsCss}
    ${buttonsCss}
    :host {
      display: block;
    }

    .admin-header {
      width: 100%;
      display: flex;
      align-items: center;
      height: 75px;
      border-bottom: solid 1px #E5E5E5;
    }

    .admin-header .admin-label {
      color: var(--ucd-blue-100, #022851);
      font-size: 2.5rem;
      font-style: normal;
      font-weight: 700;
      line-height: 2.5rem;
      padding-right: .7rem;
      padding-left: .7rem;
    }
    svg {
      width: 20.22471911px;
      height: 75px;
    }

    .admin .section {
      display: block;
      width: 53.5rem;
      padding: 3rem 0rem 4.1875rem 0rem;
      margin: 0 auto;
    }

    .admin .section img {
      max-width: 100%;
    }

    .admin .section h2 {
      color: var(--color-black-60);
    }

    @media (max-width: 992px) {
      .admin .section {
        width: 90%;
      }
    }

  </style>

  <div class="admin-header">
    <div class="admin-label">Admin</div>
    <div style="display: flex; height: 75px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
        <path d="M21.6 0L0 89H24V0H21.6Z" fill="#DBEAF7"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
        <path d="M2.4 89L24 0H0V89H2.4Z" fill="#DBEAF7"/>
      </svg>
    </div>
  </div>
<div class="admin container top">
  <div class="section">

    <h3>Current Week</h3>
    <div>
      <ul style="list-style-type: none; padding-left: 0;">
        <li><strong>Date:</strong> ${this.currentDate}</li>
        <li><strong>Year-Week Pattern:</strong> ${this.yearWeek}</li>
        <li><strong>Current Date Range:</strong> ${this.dateRangeStart} to ${this.dateRangeEnd}</li>
      </ul>
    </div>

    <br><hr><br>
    
    <div class="l-2col">
      <div class="l-first current-index-panel">
        <h3>Current Indexes</h3>
        ${this.uniqueElasticIndexes.length === 0 ? html`<p>Loading...</p>` : html`
          <ul class="list--arrow">
            ${this.uniqueElasticIndexes.map(index => html`<li>${index}</li>`)}
          </ul>
        `}

        <h5 style="margin-top: 2.5rem; margin-bottom: 1rem">Full List of Available Indexes</h5>
        ${this.availableElasticIndexes.length === 0 ? html`<p>Loading...</p>` : html`
          <ul class="list--arrow">
            ${this.availableElasticIndexes.map(i => html`<li>${i.indexName} (alias: ${i.aliasName})</li>`)}
          </ul>
        `}
      </div>
      <div class="l-second">
        <div class="preview-index-panel">
          <h3>Preview Index</h3>
          <ucd-theme-slim-select @change="${this._onPreviewIndexChange}">
            <select>
               <option></option>
              ${this.uniqueElasticIndexes.map(
                (index) => html`
                  <option
                    .value=${index}
                    ?selected=${this.currentElasticIndex === index || (!this.currentElasticIndex && index.includes('current'))}>
                    ${index}
                  </option>
                `
              )}
            </select>
          </ucd-theme-slim-select>
        </div>

        <div class="switch-index-panel">
          <h3 style="margin-top: 5rem;">Switch Current/Active Index</h3>
          <ucd-theme-slim-select @change="${this._onSwitchIndexDropdownChange}">
            <select>
               <option></option>
              ${this.uniqueElasticIndexes.map(
                (index) => html`
                  <option
                    .value=${index}
                    ?disabled=${index.includes('current')}>
                    ${index}
                  </option>
                `
              )}
            </select>
          </ucd-theme-slim-select>
          <button
            ?disabled=${!this.toSwitchIndex}
            class="btn btn--primary" 
            style="margin-top: 1rem;" 
            @click="${this._onSwitchIndex}">Switch Index</button>
        </div>
      </div>
      <app-modal-overlay
        ?hidden="${!this.showModal}"
        .visible="${this.showModal}"
        .title="${this.modalTitle}"
        .content="${this.modalContent}"
        .hideCancel="${false}"
        .hideSave="${false}"
        .hideOK="${true}"
        .hideOaPolicyLink="${true}"
        @cancel=${(e) => this.showModal = false}
        @save=${this._onSaveIndexSwitch}>
      </app-modal-overlay>
    </div>
  </div>
</div>

`;}
