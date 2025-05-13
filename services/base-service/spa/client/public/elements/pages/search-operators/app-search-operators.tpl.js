import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

export function render() {
return html`
  <style>
    ${sharedStyles}
    :host {
      display: block;
    }

    .search-operators-header {
      width: 100%;
      display: flex;
      align-items: center;
      height: 75px;
      border-bottom: solid 1px #E5E5E5;
    }

    .search-operators-header .search-operators-label {
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

    .search-operators .section {
      display: block;
      width: 53.5rem;
      padding: 3rem 0rem 4.1875rem 0rem;
      margin: 0 auto;
    }

    @media (max-width: 992px) {
      .search-operators .section {
        width: 90%;
      }
    }
  </style>

  <div class="search-operators-header">
    <div class="search-operators-label">Help</div>
    <div style="display: flex; height: 75px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
        <path d="M21.6 0L0 89H24V0H21.6Z" fill="#DBEAF7"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
        <path d="M2.4 89L24 0H0V89H2.4Z" fill="#DBEAF7"/>
      </svg>
    </div>
  </div>
  <div class="container search-operators">
    <div class="section">
      <h1>Search Operators</h1>
      <p>Search operators are special characters and commands that extend the capabilities of regular keyword searches. They can help you refine your search results and find more relevant information. Here are some common search operators:</p>
      <ul>
        <li><strong>AND</strong>: Use this operator to include multiple keywords in your search. For example, "apple AND orange" will return results that contain both terms.</li>
        <li><strong>OR</strong>: This operator allows you to search for either one term or another. For instance, "apple OR orange" will return results that contain either term.</li>
        <li><strong>NOT</strong>: Use this operator to exclude specific terms from your search. For example, "apple NOT orange" will return results that contain "apple" but not "orange".</li>
        <li><strong>" "</strong>: Enclose phrases in double quotes to search for an exact match. For example, "apple pie" will return results that contain the exact phrase.</li>
        <li><strong>*</strong>: The asterisk is a wildcard operator that can represent any word or phrase. For example, "apple*" will return results that contain "apple", "apples", "apple pie", etc.</li>
      </ul>
    </div>
  </div>
`;}
