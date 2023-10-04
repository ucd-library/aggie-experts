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
    <h3>Disclaimers</h3>

    <p>This UC Davis Library - Research Registry website contains
    material&mdash;text information, publication citations, links, and
    images&mdash;provided by The Regents of the University of California, Davis
    campus and by various third parties, both individuals and organizations,
    commercial and otherwise. To the extent copyrightable, the information
    presented on the VIVO website and available as Resource Description
    Framework (RDF) data from VIVO at The Regents of the University of
    California, Davis campus is intended for public use and is distributed under
    the terms of the <a href="http://creativecommons.org/licenses/by-nc/4.0/"
    target="_blank" rel="noopener" title="creative commons">Creative Commons CC-BY-NC 4.0</a>
    license which allows you to copy, distribute, display and make derivatives
    of this information for non-commercial use only provided you give credit to
    The Regents of the University of California, Davis campus. Any
    non-copyrightable information is available to you under a <a
    href="http://creativecommons.org/publicdomain/zero/1.0/" target="_blank"
    rel="noopener" title="cco waiver">CC0 waiver</a>.  However, source documents, images or web
    pages attached to or linked from VIVO may contain copyrighted information
    and should only be used or distributed under terms included with each source
    or in accordance with the principles of fair use.  </p>

    <h3>Disclaimer of Liability</h3>

    <p>The Regents of the University of California, Davis campus makes no
    warranty, expressed or implied, including the warranties of merchantability
    and fitness for a particular purpose, or assumes any legal liability or
    responsibility for the accuracy, completeness, currency or usefulness of any
    material displayed or distributed through the UC Davis Library - Research
    Registry website or represents that its use would not infringe privately
    owned rights.  The Regents of the University of California, Davis campus
    disclaims all warranties with regard to the information provided. Any
    reliance upon such information is at your own risk. In no event will The
    Regents of the University of California, Davis campus be liable to you for
    any damages or losses whatsoever resulting from or caused by the UC Davis
    Library - Research Registry website or its contents.</p>

    <h3>Disclaimer of Endorsement</h3>

    <p>Reference herein to any specific commercial product, process, or service
    by trade name, trademark, manufacturer, or otherwise, does not necessarily
    constitute or imply its endorsement or recommendation by The Regents of the
    University of California, Davis campus. The views and opinions of authors
    expressed herein do not necessarily state or reflect those of The Regents of
    the University of California, Davis campus and shall not be used for
    advertising or product endorsement purposes.</p>
  </div>
</div>
`;}
