/**
 * `ucdlib-icons` is a utility import that includes the definition for the
 * `ucdlib-icon` element, `ucdlib-iconset` element, as well as an import for the
 * default icon set.
 */

import { html } from "lit";
import { renderIconSet } from "@ucd-lib/theme-elements/ucdlib/ucdlib-icons/utils.js";

const template = html`
  <svg>
    <defs>
      <g id="uc-boxed" viewBox="0 0 26 25"><path id="Vector" d="M2.5 3.5V22.4583L12.4583 19.8833L22.5 22.4583V3.5H2.5ZM11.6417 12.8583C11.6417 13.9583 11.375 14.8083 10.825 15.425C10.275 16.0333 9.425 16.3417 8.30833 16.3417C7.125 16.3417 6.24167 16.0417 5.69167 15.4417C5.14167 14.8417 4.85833 14.0167 4.85833 12.9667V7.8H6.45V12.8333C6.45 13.575 6.6 14.125 6.89167 14.4667C7.18333 14.8083 7.66667 14.975 8.34167 14.975C8.96667 14.975 9.43333 14.7917 9.71667 14.4333C10.025 14.0083 10.1833 13.4917 10.1583 12.9583V7.79167H11.6417V12.8417V12.8583ZM20.1333 15.4583C20 15.575 19.8583 15.6833 19.7083 15.7667C19.5167 15.8833 19.3167 15.975 19.1083 16.05C18.8667 16.1333 18.625 16.2 18.375 16.25C18.0917 16.3083 17.8083 16.3333 17.525 16.3333C16.9 16.3417 16.2833 16.225 15.7083 15.975C15.2083 15.75 14.7583 15.425 14.3917 15.0083C14.0333 14.6 13.7667 14.125 13.5917 13.6167C13.4167 13.0917 13.325 12.5417 13.325 11.9833C13.325 11.425 13.4167 10.875 13.6 10.35C13.775 9.84167 14.0583 9.375 14.4167 8.96667C14.7917 8.55833 15.2417 8.23333 15.75 8.00833C16.3167 7.75833 16.9333 7.63333 17.55 7.64167C18.0167 7.63333 18.4833 7.69167 18.9417 7.80833C19.3167 7.91667 19.6667 8.08333 19.9917 8.29167L20.075 8.35L19.3167 9.54167L19.2333 9.48333C18.725 9.14167 18.125 8.975 17.5167 9C17.1417 8.99167 16.7667 9.06667 16.4167 9.23333C16.1083 9.38333 15.8417 9.6 15.625 9.86667C15.4083 10.1417 15.2417 10.4583 15.1417 10.7917C15.0333 11.1583 14.975 11.5333 14.9833 11.9167C14.9833 12.3083 15.0333 12.7 15.1417 13.0833C15.2417 13.4333 15.4 13.7667 15.625 14.0583C15.8333 14.3333 16.1083 14.5583 16.4167 14.7167C16.7667 14.8833 17.15 14.9667 17.5417 14.9583C17.9083 14.9667 18.2833 14.9083 18.625 14.775C18.9 14.6667 19.1583 14.5167 19.3917 14.325L19.4833 14.25L20.1917 15.3833L20.1333 15.4417V15.4583Z" fill="#73ABDD"/></g>
      <g id="fa-network-wired" height="1em" viewBox="0 0 640 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M256 64H384v64H256V64zM240 0c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48h48v32H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96v32H80c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48H240c26.5 0 48-21.5 48-48V368c0-26.5-21.5-48-48-48H192V288H448v32H400c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48H560c26.5 0 48-21.5 48-48V368c0-26.5-21.5-48-48-48H512V288h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V192h48c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48H240zM96 448V384H224v64H96zm320-64H544v64H416V384z"/></g>
      <g id="fa-user" height="1em" viewBox="0 0 448 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></g>
      <g id="fa-address-card" height="1em" viewBox="0 0 576 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm80 256h64c44.2 0 80 35.8 80 80c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16c0-44.2 35.8-80 80-80zm-32-96a64 64 0 1 1 128 0 64 64 0 1 1 -128 0zm256-32H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></g>
      <g id="fa-circle-chevron-left" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M512 256A256 256 0 1 0 0 256a256 256 0 1 0 512 0zM271 135c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-87 87 87 87c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L167 273c-9.4-9.4-9.4-24.6 0-33.9L271 135z"/></g>
      <g id="fa-circle-chevron-right" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M0 256a256 256 0 1 0 512 0A256 256 0 1 0 0 256zM241 377c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l87-87-87-87c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0L345 239c9.4 9.4 9.4 24.6 0 33.9L241 377z"/></g>
      <g id="fa-book-open" height="1em" viewBox="0 0 576 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M249.6 471.5c10.8 3.8 22.4-4.1 22.4-15.5V78.6c0-4.2-1.6-8.4-5-11C247.4 52 202.4 32 144 32C93.5 32 46.3 45.3 18.1 56.1C6.8 60.5 0 71.7 0 83.8V454.1c0 11.9 12.8 20.2 24.1 16.5C55.6 460.1 105.5 448 144 448c33.9 0 79 14 105.6 23.5zm76.8 0C353 462 398.1 448 432 448c38.5 0 88.4 12.1 119.9 22.6c11.3 3.8 24.1-4.6 24.1-16.5V83.8c0-12.1-6.8-23.3-18.1-27.6C529.7 45.3 482.5 32 432 32c-58.4 0-103.4 20-123 35.6c-3.3 2.6-5 6.8-5 11V456c0 11.4 11.7 19.3 22.4 15.5z"/></g>
      <g id="scopus" width="26" height="25" viewBox="0 0 26 25" fill="none"><path opacity="0.999" d="M0.5 0.650879V24.3488H25.5V0.650879H0.5ZM8.10517 6.81763C9.5519 6.81763 10.1911 6.97721 11.0827 7.32803L10.9986 8.58767C10.0397 8.04549 9.28275 7.88616 8.18928 7.88616C6.9276 7.88616 6.28823 8.79499 6.28823 9.6242C6.28823 10.7404 7.41536 11.1551 8.4752 11.7611C9.8378 12.5265 11.251 13.2122 11.251 14.7271C11.251 16.7204 9.45086 17.725 7.73495 17.725C6.5069 17.725 5.61539 17.5496 4.74061 17.1668L4.9426 15.907C5.80055 16.4014 6.54072 16.6407 7.66782 16.6407C8.81174 16.6407 9.77048 15.9072 9.77048 14.8866C9.77048 13.8341 8.69399 13.4354 7.66782 12.8453C6.28838 12.048 4.77437 11.3464 4.77437 9.71984C4.77437 8.09332 6.036 6.81763 8.10517 6.81763ZM18.6328 6.81763C20.3319 6.81763 21.0889 7.00907 22.0141 7.42367L21.9132 8.61967C20.9039 8.09343 19.844 7.88616 18.4646 7.88616C16.2776 7.88616 14.4103 9.52854 14.4103 12.1916C14.4103 14.7111 16.3113 16.6087 18.7001 16.6087C19.7936 16.6087 20.8871 16.4014 21.9132 15.8752L22.0141 17.0871C21.1057 17.5177 19.9619 17.6932 18.5824 17.6932C15.8403 17.6932 12.8964 15.7795 12.8964 12.2872C12.8964 9.22552 15.3692 6.81763 18.6328 6.81763Z" fill="#73ABDD"/></g>
      <g id="fa-orcid" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M294.75 188.19h-45.92V342h47.47c67.62 0 83.12-51.34 83.12-76.91 0-41.64-26.54-76.9-84.67-76.9zM256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm-80.79 360.76h-29.84v-207.5h29.84zm-14.92-231.14a19.57 19.57 0 1 1 19.57-19.57 19.64 19.64 0 0 1-19.57 19.57zM300 369h-81V161.26h80.6c76.73 0 110.44 54.83 110.44 103.85C410 318.39 368.38 369 300 369z"/></g>
      <g id="fa-envelope" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/></g>
      <g id="fa-search" viewBox="0 0 512 512"><!-- Font Awesome Pro 5.15.4 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) --><path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z" /></g>
      <g id="fa-pen-to-square" height="1em" viewBox="0 0 512 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/></g>
      <g id="fa-cloud-arrow-down" height="1em" viewBox="0 0 640 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-167l80 80c9.4 9.4 24.6 9.4 33.9 0l80-80c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-39 39V184c0-13.3-10.7-24-24-24s-24 10.7-24 24V318.1l-39-39c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9z"/></g>
      <g id="fa-eye-slash" height="1em" viewBox="0 0 640 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z"/></g>
      <g id="fa-trash" height="1em" viewBox="0 0 448 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></g>
      <g id="fa-xmark" height="1em" viewBox="0 0 384 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></g>
      <!-- academicons -->
      <g
        width="512"
        height="512"
        viewBox="0 0 512 512"
        version="1.1"
        id="ai-clarivate"
        inkscape:version="1.2 (1:1.2.1+202207142221+cd75a1ee6d)"
        sodipodi:docname="clarivate.svg"
        xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
        xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:svg="http://www.w3.org/2000/svg"
        xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        xmlns:cc="http://creativecommons.org/ns#"
        xmlns:dc="http://purl.org/dc/elements/1.1/">
        <title
          id="title1279">clarivate</title>
        <defs
          id="defs2" />
        <sodipodi:namedview
          scale-x="1"
          id="base"
          pagecolor="#ffffff"
          bordercolor="#666666"
          borderopacity="1.0"
          inkscape:pageopacity="0.0"
          inkscape:pageshadow="2"
          inkscape:zoom="0.75"
          inkscape:cx="320"
          inkscape:cy="258"
          inkscape:document-units="px"
          inkscape:current-layer="layer6"
          inkscape:document-rotation="0"
          showgrid="true"
          units="px"
          showguides="true"
          inkscape:guide-bbox="true"
          inkscape:window-width="1848"
          inkscape:window-height="1016"
          inkscape:window-x="72"
          inkscape:window-y="27"
          inkscape:window-maximized="1"
          inkscape:showpageshadow="2"
          inkscape:pagecheckerboard="0"
          inkscape:deskcolor="#d1d1d1">
          <inkscape:grid
            type="xygrid"
            id="grid10"
            empspacing="4"
            originx="0"
            originy="0" />
        </sodipodi:namedview>
        <metadata
          id="metadata5">
          <rdf:RDF>
            <cc:Work
              rdf:about="">
              <dc:format>image/svg+xml</dc:format>
              <dc:type
                rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
              <cc:license
                rdf:resource="http://scripts.sil.org/OFL" />
              <dc:title>clarivate</dc:title>
              <dc:subject>
                <rdf:Bag>
                  <rdf:li>clarivate</rdf:li>
                </rdf:Bag>
              </dc:subject>
            </cc:Work>
            <cc:License
              rdf:about="http://scripts.sil.org/OFL">
              <cc:permits
                rdf:resource="http://scripts.sil.org/pub/OFL/Reproduction" />
              <cc:permits
                rdf:resource="http://scripts.sil.org/pub/OFL/Distribution" />
              <cc:permits
                rdf:resource="http://scripts.sil.org/pub/OFL/Embedding" />
              <cc:permits
                rdf:resource="http://scripts.sil.org/pub/OFL/DerivativeWorks" />
              <cc:requires
                rdf:resource="http://scripts.sil.org/pub/OFL/Notice" />
              <cc:requires
                rdf:resource="http://scripts.sil.org/pub/OFL/Attribution" />
              <cc:requires
                rdf:resource="http://scripts.sil.org/pub/OFL/ShareAlike" />
              <cc:requires
                rdf:resource="http://scripts.sil.org/pub/OFL/DerivativeRenaming" />
              <cc:requires
                rdf:resource="http://scripts.sil.org/pub/OFL/BundlingWhenSelling" />
            </cc:License>
          </rdf:RDF>
        </metadata>
        <g
          inkscape:groupmode="layer"
          id="layer6"
          inkscape:label="icon">
          <path
            id="path207"
            style="stroke:none;stroke-width:1"
            d="M 235.35568,7.9999988 C 211.96101,42.200846 193.19105,79.944801 179.68464,120.05202 275.49233,137.92323 362.26687,192.9131 424.19743,275.05203 449.10589,242.12159 469.54208,205.42916 484.90552,166.1 417.08876,88.469713 330.55362,33.645185 235.35568,7.9999988 Z M 424.19743,275.05203 C 362.26787,345.46121 275.48737,392.62982 179.68464,407.96447 193.26677,442.34555 212.07277,474.70922 235.54945,504 330.65447,481.98322 417.14431,434.99416 484.90552,368.50404 469.53878,334.78298 449.11151,303.28698 424.19743,275.05203 Z M 98.632613,122.50623 c -16.251934,0.1984 -32.455925,1.15072 -48.631144,2.96939 -30.518549,97.68654 -30.544667,201.45338 -0.06617,299.15016 43.178448,4.85915 86.861501,3.8989 129.747651,-2.84043 C 146.69829,339.91162 142.18137,250.51158 166.70197,166.1 c 3.69619,-12.84476 8.02461,-25.46333 12.9165,-37.78132 -26.7764,-4.20509 -53.90065,-6.1256 -80.987546,-5.81246 z" />
        </g>
      </g>
    </defs>
  </svg>
`;
renderIconSet(template, "ucdlib-experts", 24);
