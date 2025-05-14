import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';
import tableStyles1 from '@ucd-lib/theme-sass/1_base_html/_tables.css';
import tableStyles2 from '@ucd-lib/theme-sass/2_base_class/_tables.css';
import responsiveTableStyles from '@ucd-lib/theme-sass/4_component/_responsive-table.css';

export function render() {
return html`
  <style>
    ${sharedStyles}
    ${tableStyles1}
    ${tableStyles2}
    ${responsiveTableStyles}
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

    .search-operators .section h3 {
      margin-top: 3rem;
    }

    .search-operators .section h3:first-of-type {
      padding-top: 0;
      margin-top: 0;
    }

  </style>

  <div class="search-operators-header">
    <div class="search-operators-label">Search Tips</div>
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
      <h3>Default search</h3>
      <p>
        Aggie Experts' default search will look for matches of <strong>all keywords</strong> in titles of works and grants,
        in abstracts of grants, experts' bios, affiliations, and journal and publisher names.
      </p>
      <p>
        For example, <em>heart surgery</em> will return results that have both <em>heart</em> <strong>AND</strong> <em>surgery</em> present in the listed fields.
      </p>

      <h3>Search operators to refine results</h3>
      <p>
        If your query returns either too few or too many results, try using one or more of the following operators to modify your results:
      </p>
      <div class="responsive-table" role="region" aria-label="Scrollable Table" tabindex="0">
        <table class="table--bordered">
          <thead>
            <tr>
              <th>Operator</th>
              <th>What it does</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>|</td>
              <td>Search for results related to either X <strong>OR</strong> Y.</td>
              <td><strong>heart | cardiac surgery</strong> may include <em>heart surgery</em> OR <em>cardiac surgery</em></td>
            </tr>
            <tr>
              <td>*</td>
              <td>Search variations of the word</td>
              <td><strong>Cardi* surgery</strong> may include <em>cardiac surgery, cardiothoracic surgery</em>, etc.</td>
            </tr>
            <tr>
              <td>""</td>
              <td>Match an exact phrase</td>
              <td><strong>"heart surgery"</strong></td>
            </tr>
            <tr>
              <td>-</td>
              <td>Exclude keywords from your results</td>
              <td><strong>heart surgery -thoracic</strong></td>
            </tr>
            <tr>
              <td>()</td>
              <td>Indicate precedence in complex searches with multiple operators</td>
              <td>
                <strong>(cardiac | heart) + (injury | trauma)</strong> includes results for <em>cardiac</em> AND <em>injury</em>,
                or <em>cardiac</em> AND <em>trauma</em>, or <em>heart</em> AND <em>injury</em>, or <em>heart</em> AND <em>trauma</em>. Without parentheses,
                results might contain just <em>cardiac</em>, or both <em>heart</em> AND <em>injury</em>, or just <em>trauma</em>.
              </td>
            </tr>
            <tr>
              <td>~#</td>
              <td>Allows fuzzy searching for near matches (higher number = higher result variation)</td>
              <td>
                <strong>pediatric~1</strong> may include the British spelling paediatric; a phrase search for <strong>"pediatric surgery"~1</strong> may
                include additional words such as <em>pediatric scoliosis surgery, pediatric cardiac surgery</em>, etc.
              </td>
            </tr>
            <tr>
              <td>+</td>
              <td>Search for results related to X <strong>AND</strong> Y</td>
              <td><strong>heart + surgery</strong></td>
            </tr>
          </tbody>
        </table>
      </div>


    </div>
  </div>
`;}
