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

    .admin .section h3 {
      margin-bottom: .875rem;
    }
    
    .admin .section h5 {
      margin-top: 0;
      padding-top: 0;
      margin-bottom: 0;
    }

    .admin .section .index-date-range {
      margin-top: .25rem;
    }

    .admin-seperator {
      display: block;
      height: 4px;
      border: 0;
      padding: 0;
      margin: 2.38rem 0;
    }

    .admin-seperator {
      border-top: 4px dotted var(--color-aggie-gold);
    }

    @media (max-width: 992px) {
      .admin .section {
        width: 90%;
      }
    }

    .admin .data-mismatch-warning {
      display: flex;
      gap: .5rem;
      margin-top: 1.75rem;
    }
    
    .admin .data-mismatch-warning ucdlib-icon {
      color: var(--secondary-strawberry, #F93549);
      fill: var(--secondary-strawberry, #F93549);
    }
  
    .admin .data-mismatch-warning .data-mismatch-index {
      margin: 0;
      font-style: italic;
      line-height: 1.75rem;
      color: var(--color-black-70, #4C4C4C);
    }
      
    .admin .admin-status-banner {
      display: flex;
      gap: .5rem;
      align-items: center;
      padding: .875rem;
      margin: 1.19rem 0;
    }

    .admin .admin-status-banner p {
      margin: 0;
    }

    .admin .admin-status-banner.failed {
      background-color: #F1F1F1;
    }

    .admin .admin-status-banner.pending {
      background-color: var(--color-blue-30, #EBF3FA);
    }

    .admin .admin-status-banner.success {
      background-color: #aada904d;
    }
    
    .admin .admin-status-banner.failed ucdlib-icon {
      color: var(--secondary-strawberry, #F93549);
      fill: var(--secondary-strawberry, #F93549);
    }

    .admin .admin-status-banner.pending ucdlib-icon {
      color: var(--color-aggie-blue-70, #13639E);
      fill: var(--color-aggie-blue-70, #13639E);
    }

    .admin .admin-status-banner.success ucdlib-icon {
      color: var(--color-quad, #3DAE2B);
      fill: var(--color-quad, #3DAE2B);
    }

    .admin .admin-management h3 {
      margin-bottom: 2.38rem;
    }

    .admin .admin-management .toggle-controls {
      display: inline-block;
      border-radius: 2rem;
      border: 1px solid var(--ucd-black-50, #999);
      padding: .5rem;
    }

    .admin .admin-management .toggle-controls button {
      border: none;
      border-radius: 2rem;
      color: var(--ucd-blue-80, #13639E);
      font-size: 1rem;
      font-weight: 400;
    }

    .admin .admin-management .toggle-controls button span {
      margin-left: .5rem; 
      margin-right: .5rem;
    }
  
    .admin .admin-management .toggle-controls button[active] {
      background-color: #022851; 
      color: white; 
    }

    .admin .admin-management .toggle-controls button:not([active]):hover {
      background-color: #DBEAF7; 
    }

    .admin .admin-management .manage-content {
      padding-top: 1.19rem;
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

    <div class="admin-status-banner failed">
      <ucdlib-icon icon="ucdlib-experts:fa-ban"></ucdlib-icon>
      <p>Latest data version ingest failed</p>
    </div>

    <div class="admin-status-banner pending">
      <ucdlib-icon icon="ucdlib-experts:fa-hourglass-half"></ucdlib-icon>
      <p>New data version ready for review</p>
    </div>

    <div class="admin-status-banner success">
      <ucdlib-icon icon="ucdlib-experts:fa-check-circle"></ucdlib-icon>
      <p>Latest data version is live on the public site</p>
    </div>

    <div class="l-2col">
      <div class="l-first">
        <h3>Public Version</h3>
        <h5 class="index-name">YYYY-MM</h5>
        <p class="index-date-range">Febbbbb 2 - 8, 2026</p>
      
      </div>
      <div class="l-second">

        <h3>Latest Version</h3>
        <h5 class="index-name">YYYY-MM</h5>
        <p class="index-date-range">Febbbbb 2 - 8, 2026</p>

        <div class="data-mismatch-warning">
          <ucdlib-icon icon="ucdlib-experts:fa-exclamation-triangle"></ucdlib-icon>
          
          <div>
            <strong>Data mismatch detected</strong>
            <p class="data-mismatch-index">experts-2026-42 (alias: experts-latest)</p>
            <p class="data-mismatch-index">grants-2026-42 (alias: grants-latest)</p>
            <p class="data-mismatch-index">works-2026-42 (alias: works-latest)</p>  
          </div>
        </div>
      </div>
    </div>

    <hr class="admin-seperator">

    <div class="admin-management">
      <h3>Manage Data Versions</h3>

      <div class="toggle-controls">
        <button class="btn btn--round" 
          ?active="${this.manageDataAction === 'preview'}"
          @click="${(e) => this.manageDataAction = 'preview'}">
          <ucdlib-icon icon="ucdlib-experts:fa-flask"></ucdlib-icon>
          <span>Preview</span>
        </button>

        <button class="btn btn--round" 
          ?active="${this.manageDataAction === 'publish'}"
          @click="${(e) => this.manageDataAction = 'publish'}">
          <ucdlib-icon icon="ucdlib-experts:fa-rocket"></ucdlib-icon>
          <span>Publish</span>
        </button>

        <button class="btn btn--round" 
          ?active="${this.manageDataAction === 'delete'}"
          @click="${(e) => this.manageDataAction = 'delete'}">
          <ucdlib-icon icon="ucdlib-experts:fa-trash"></ucdlib-icon>
          <span>Delete</span>
        </button>
      </div>

      <div class="manage-content">
        <div ?hidden="${this.manageDataAction !== 'preview'}">
          <ucd-theme-slim-select @change="${this._updateSlimSelectStyles}">
            <select>
               <option><span style="margin-left: .5rem;">Select data version</span></option>
              ${this.uniqueElasticIndexes.map(
                (index) => html`
                  <option
                    .value=${index.indexDisplayName}
                    ?selected=${this.currentElasticIndex === index.indexDisplayName}>
                    <span style="display: flex; align-items: center; flex-direction: column; align-items: flex-start;">
                      <span style="color: #13639E; font-size: 1rem; font-style: normal; font-weight: 700; margin-left: .5rem;">
                        ${index.indexDisplayName}<span style="font-weight: 400; margin-left: .5rem;">(${index.displayLabels})</span>
                      </span>
                      <span style="color: #4C4C4C; font-size: .875rem; font-style: italic; font-weight: 400; margin-left: .5rem; margin-top: .09rem;">
                        ${index.dateRange}
                      </span>
                    </span>
                  </option>
                `
              )}
            </select>
          </ucd-theme-slim-select>

            
          <button
            ?disabled=${this.toSwitchIndex}
            class="btn btn--primary btn--lg" 
            style="margin-top: 2.38rem;" 
            @click="${this._onPreviewIndexChange}">Preview Locally</button>



        </div>
        <div ?hidden="${this.manageDataAction !== 'publish'}">
          TODO publish stuff
        </div>
        <div ?hidden="${this.manageDataAction !== 'delete'}">
          TODO delete stuff
        </div>
      </div>




    </div>





    <br><br><br><br><br><br><br><br><br><br>
    // old

    <h3>Current Week</h3>
    <div>
      <ul style="list-style-type: none; padding-left: 0;">
        <li><strong>Date:</strong> ${this.currentDate}</li>
        <li><strong>Year-Week Pattern:</strong> ${this.yearWeek}</li>
        <li><strong>Current Date Range:</strong> ${this.dateRangeStart} to ${this.dateRangeEnd}</li>
      </ul>
      ${this.uniqueElasticIndexes.length === 0 ? html`<p>Loading...</p>` : html`
          <ul class="list--arrow">
            ${this.uniqueElasticIndexes.map(index => html`<li>${index.indexDisplayName} (${index.displayLabels}) - ${index.dateRange}</li>`)}
          </ul>
        `}

        
        ${this.availableElasticIndexes.length === 0 ? html`<p>Loading...</p>` : html`
          <ul class="list--arrow">
            ${this.availableElasticIndexes.map(i => html`<li>${i.indexName} (alias: ${i.aliasName})</li>`)}
          </ul>
        `}

        <button
            ?disabled=${!this.toSwitchIndex}
            class="btn btn--primary" 
            style="margin-top: 1rem; background-color: #C10230; color: white;" 
          @click="${this._onDeleteIndex}">Delete Index</button>



                  <div class="preview-index-panel">
          <h3>Preview Index</h3>
          <ucd-theme-slim-select @change="${this._onPreviewIndexChange}">
            <select>
               <option></option>
              ${this.uniqueElasticIndexes.map(
                (index) => html`
                  <option
                    .value=${index.indexDisplayName}
                    ?selected=${this.currentElasticIndex === index.indexDisplayName}>
                    ${index.indexDisplayName}
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
                    .value=${index.indexDisplayName}
                    ?disabled=${index.displayLabels.toLowerCase().includes('public')}>
                    ${index.indexDisplayName}
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

    <br><hr><br>

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

`;}
