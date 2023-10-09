import { html } from 'lit';

import { sharedStyles } from '../styles/shared-styles';

export default function render() {
return html`
<style>
  ${sharedStyles}
  :host {
    display: block;
    background-color: var(--ae-color-white);
  }

  .tou .section {
    display: block;
    width: 53.5rem;
    padding: 3rem 0rem 4.1875rem 0rem;
    margin: 0 auto;
  }

  .tou-header {
    width: 100%;
    display: flex;
    align-items: center;
    height: 75px;
    border-bottom: solid 1px #E5E5E5;
  }

  .tou-header .tou-label {
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

  @media (max-width: 992px) {
    .tou .section {
      width: 90%;
    }
  }

</style>

<div class="tou-header">
  <div class="tou-label">Terms Of Use</div>
  <div style="display: flex; height: 75px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
      <path d="M21.6 0L0 89H24V0H21.6Z" fill="#DBEAF7"/>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
      <path d="M2.4 89L24 0H0V89H2.4Z" fill="#DBEAF7"/>
    </svg>
  </div>
</div>

<div class="tou container top">
  <div class="section">
    <p>
      All data are provided as-is. Only data from authoritative sources is added, but as no source is truly comprehensive,
      neither the accuracy nor completeness of scholarship representation is guaranteed.
      <br><br>
      Additional parties may query and retrieve Aggie Experts data under the conditions outlined in <strong>"Permitted Use"</strong> below except
      for any third-party content that may be subject to copyright. UC Davis reserves the right to modify these Terms as needed.
    </p>

    <h3>1. Permitted Uses</h3>
    <ol style="list-style: lower-roman;">
      <li>
        API queries for retrieval of publicly visible data for personal, scholarly, and UCOP- and UC Davis-specific
        administrative use, including API access by third parties, both commercial and non-commercial, academic and non-academic.
      </li>
      <li>
        Application development based on retrieval of publicly visible data for personal, scholarly, and UCOP- and UC Davis-specific
        administrative use, including applications developed by third parties, both commercial and non-commercial, academic and non-academic.
      </li>
      <li>
        Additional access to public data to which a researcher has restricted visibility may be granted to UC Davis and UCOP users after review.
        UC Davis administrators will be granted access to restricted visibility data within the scope of their organizational assignment.
        Visibility-restricted public data may not be shared further without approval.
      </li>
    </ol>

    <h3>2. Prohibited Uses</h3>
    <p>
      Sale and monetization of data or derivatives of data obtained from Aggie Experts through any methods and any format by third parties.
    </p>

    <h3>3. Extended Uses</h3>
    <p>
      For uses extending beyond the ones explicitly permitted, but not prohibited, contact the Aggie Expert Data Custodian to request a review.
      The Aggie Experts data custodians and the Data Steward (to be identified) will consult with stakeholders,
      such as the Academic Senate as appropriate. The Provost and Executive Vice Chancellor, as the Data Trustee, will have final approval.
      A log of all requests and decisions will be maintained for three years from the date when the request was made.
    </p>
  </div>
</div>
`;}
