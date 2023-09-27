import { LitElement, html, svg } from 'lit';
import {render, styles} from "./ucdlib-site-footer.tpl.js";
import ThemeUtils from "../themeUtils";

/**
 * @class UcdlibSiteFooter
 * @description UI component class for displaying the standard UC Davis site footer
 * The column links can be customized by using children in the Light DOM:
 * <ucdlib-site-footer>
 *   <ucdlib-site-footer-column header="Header Title">
 *     <ul>
 *       <li><a>A link</a></li>
 *     </ul>
 *   </ucdlib-site-footer-column>
 * </ucdlib-site-footer>
 */
export default class UcdlibSiteFooter extends Mixin(LitElement)
  .with(ThemeUtils) {

  static get properties() {
    return {
      lastUpdate: {type: String, attribute: "last-update"}
    };
  }

  static get styles() {
    return styles();
  }

  constructor() {
    super();
    this.render = render.bind(this);
    this.lastUpdate = "";
    this.defaultShadowAnchor = "section-columns";
  }

  /**
   * @method _renderCampusInfo
   * @description Renders the UCD information below the Aggies image.
   * 
   * @returns {TemplateResult}
   */
  _renderCampusInfo() {
    return html`
      <div class="campus-info">
        <div class="row">
          <span><a href="https://www.ucdavis.edu/">University of California, Davis</a>, One Shields Avenue, Davis, CA 95616 | <a class="kt plain" href="tel:+1-530-752-1011">530-752-1011</a></span>
        </div>
        <div class="row">
          <ul>
            <li><a href="https://www.ucdavis.edu/contact" class="pipe" target="_blank">Questions or Comments?</a></li>
            <li><a href="https://www.ucdavis.edu/help/privacy-accessibility" class="pipe" target="_blank">Privacy & Accessibility</a></li>
            <li><a href="http://www.universityofcalifornia.edu/" class="${this.lastUpdate ? 'pipe' : ''}" target="_blank">University of California</a></li>
            ${this.lastUpdate ? html`
              <li>Last Updated: ${this.lastUpdate}</li>
            ` : html``}
          </ul>
        </div>
        <div class="row">
          <span>Copyright © The Regents of the University of California, Davis campus. All rights reserved.</span>
        </div>
      </div>
      
    `;
  }

  /**
   * @method _renderLibraryLogo
   * @description Renders the library logo
   * 
   * @returns {SVGTemplateResult}
   */
  _renderLibraryLogo(){
    return svg`
    <svg id="lib-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1512 436.85">
      <title>ucd_lib-logo-signature-reverse-cmyk</title>
      <rect width="1512" height="436.84" style="fill:none"/>
      <path d="M1369.7,174.66l18.45-48.81,3.21,2.78c11.33,9.23,26.7,17.09,41.19,17.41,13,.29,19.31-3.16,17.59-14.13-1.28-8.19-10.54-9.64-16.31-10.78l-12.69-2.53c-24.68-4.61-45.44-19.84-45.44-48.68,0-43.61,37.61-68.07,75.4-68.07A98.39,98.39,0,0,1,1506.24,18l-16,43.25c-8.78-6.33-22.06-15.23-38.92-15.84-5.53-.21-18.19,2.69-14.13,15.57,1.75,5.46,9.61,7.76,14.42,8.94l14.31,3.45C1492.63,79.6,1512,94.82,1512,126c0,43.83-37.82,65.53-75.39,65.53-21.92,0-47.31-6.23-66.91-16.84" style="fill:#fff"/>
      <rect x="1291.72" y="4.85" width="64.38" height="183.9" style="fill:#fff"/>
      <polygon points="1219.15 4.85 1285.1 4.85 1217.76 188.75 1164.24 188.75 1097.11 4.85 1162.84 4.85 1190.99 115.81 1219.15 4.85" style="fill:#fff"/>
      <path d="M941,188.75h66.9l5.08-23.09h47.74l6.33,23.09h66.91L1071.27,4.85H1001.1Zm96-130.82h0c1.18,7.82,12.71,64.11,12.71,64.11H1024.3Z" style="fill:#fff"/>
      <path d="M840.4,135.93h4.31c21.22,0,37-12.72,37-36.71,0-25.85-13.95-40.26-37.25-40.26h-4ZM775.61,4.85h65.93c58.82,0,103.79,27,103.79,94.6,0,54.46-36.66,89.3-88.11,89.3l-81.61-.1Z" style="fill:#fff"/>
      <path d="M737.11,10.62l3.43,30.17c.81,7.16,4.89,24.35-.16,22.05-3.16-1.42-5.76-9.22-8.35-16.12-1.31-3.52-7.59-20.13-9.22-21.36-7.93-5.92-27.69-12.6-41-12.67-40.54-.15-67.37,29.77-67.37,82.84,0,38.07,18.23,83.73,64.59,83.73,16.61,0,48.42-5.22,57.09-28.86,3.9-10.71,7.49-20.21,10.08-17.32,1.93,2.1-.57,10.67-1.73,15.28-5.45,21.91-5.75,28.55-7.49,29.4-20.95,10.52-47.81,14-71.32,14-74.76,0-100.57-43.62-100.57-87.22C565,28.86,611.51-3,683.58.24a169.72,169.72,0,0,1,53.53,10.38" style="fill:#fff"/>
      <path d="M516.37,14l-12-4.18c-4-3.62.87-4.63.87-4.63s17.31,3.21,60.41-.44c0,0,3.74.75,1.15,3.78l-14.13,6c-9.23,4.05-9.23,1.73-9.23,11.83l-.07,93.72c0,73.3-74.56,71.66-89.08,71.66-6.91,0-75.29,0-75.29-58.86V33.69c0-17.3,1.84-16.84-3.92-18.87L357.82,8.33s-2.92-4.15,2.3-3.89c14.11.72,34.61,3.76,82.73.28,0,0,4.18,1,1.44,4.05l-14.38,4c-11,4.91-9.52,1.16-9.81,12.4l.34,97.82c0,24,12.33,53.68,51.18,53.68,52.83,0,53.32-45.7,53.32-55.86L525,24c.56-9.13-.59-6.53-8.67-10" style="fill:#fff"/>
      <rect x="379.05" y="229.5" width="1132.95" height="7.66" style="fill:#fff"/>
      <path d="M419,403h48v33.89H379V282.92h40Z" style="fill:#fff"/>
      <path d="M551.25,436.84h-40V282.92h40Z" style="fill:#fff"/>
      <path d="M601.88,436.84V282.92H659c27.36,0,45.73,10.61,45.73,40,0,13.88-4.49,25.11-16.94,31.44v.41c22,2.85,31.44,17.76,31.44,39.19,0,32.26-27.56,42.87-55.73,42.87Zm40-93.5h4.49c10.61,0,21.64-1.83,21.64-14.9,0-14.09-12.46-14.9-23.28-14.9H641.9Zm0,62.88H647c11.84,0,31.85.61,31.85-16.33,0-18.58-19.81-16.74-32.87-16.74H641.9Z" style="fill:#fff"/>
      <path d="M886.67,436.84H836.86l-37.77-59.2h-.41v59.2h-40V282.92h59.82c30.41,0,53.48,14.49,53.48,47.36,0,21.23-11.84,39.6-33.68,43.48Zm-88-84.92h3.88c13.07,0,27.77-2.45,27.77-19.19s-14.7-19.19-27.77-19.19h-3.88Z" style="fill:#fff"/>
      <path d="M951.59,410.1,941,436.84H898.52l59.2-153.92h43.69l58,153.92h-42.66l-10-26.74Zm28-79.62h-.41l-16.53,49h33.27Z" style="fill:#fff"/>
      <path d="M1210.87,436.84h-49.82l-37.76-59.2h-.41v59.2h-40V282.92h59.81c30.42,0,53.49,14.49,53.49,47.36,0,21.23-11.84,39.6-33.69,43.48Zm-88-84.92h3.88c13.06,0,27.76-2.45,27.76-19.19s-14.7-19.19-27.76-19.19h-3.88Z" style="fill:#fff"/>
      <path d="M1216.38,282.92h48l28.78,41.85,28.79-41.85h48l-56.75,80v73.9h-40v-73.9Z" style="fill:#fff"/>
      <path d="M148,330.23l-45.6,12.41v33.62l141,22.18V137.22L171.94,126V298.29C171.94,312.79,161.65,326.52,148,330.23Z" style="fill:none"/>
      <path d="M102.39,342.64,148,330.23c13.66-3.71,23.95-17.44,23.95-31.94V126L102.39,115Z" style="fill:#fff"/>
      <path d="M171.94,92.74V4.85L24.87,36C10.69,39,0,52.66,0,67.81v302.7l69.55-18.93V76.63Z" style="fill:#fff"/>
      <path d="M250.56,105.1,171.94,92.74V126l71.49,11.24V398.44l-141-22.18V342.64l-32.84,8.94v25.48c0,15.3,11.3,29.06,25.72,31.33l181,28.46V136.43C276.27,121.13,265,107.37,250.56,105.1Z" style="fill:#fff"/>
    </svg>
    `;
  }

  /**
   * @method _renderAggieLogo
   * @description Renders the aggie logo
   * 
   * @returns {SVGTemplateResult}
   */
  _renderAggieLogo(){
    return svg`
    <svg id="aggie-logo" data-name="Group 1648" xmlns="http://www.w3.org/2000/svg" width="272.123" height="205.617" viewBox="0 0 272.123 205.617">
      <path id="Path_1799" data-name="Path 1799" d="M366.856,180.831l.029-60.673-76.545-.037-.656-.387-.33,1.056.329.9,1.31,1.048.328.909.491,1.952,1.148,1.655h-.656l.816,1.805-.491,1.2-.66,2.555v1.8l-.653-.3-.329,1.055.98,2.559L287.7,146.65l-.987,2.256v1.2l.654.912.331.9-.332,1.2.162.446,3.285,2.861,1.475.757.491,1.5.984.9,1.477,1.958.491.9,1.64,1.349v1.21l.49,1.047.329,3.007-.491,1.208-.494,1.349v1.959l.493,1.355.98,2.405.986,1.951-.66,2.256.33.755.985.9,1.31,1.2,1.642,1.5.329.6.981.3.819,1.2,1.643,2.258,1.148.75,2.295,1.356.98,2.413h.659l.985.748.325.6.988,1.5H313.6l-.492-.6-.326.154.326.746-.657,3.46.161.454.82-.453.168-.747.492-.455.329.9h.82l.821.6.49.755.823.449.984.6.491-.3,1.311,1.057,1.316.9.491.154-.164-1.355h.165l.651.446.333-.146-.656-1.057-.327-1.047.328-.6-.818-.456.492-1.8-.658-.6.985.3.818-1.055.495.154,2.131.749v.609l.659.146.819.453.821.45v.3l-.49-.146-1.319-.155-.651.754h-1.314l-.819,1.357,1.8,1.35v.446l.163,1.509.5.748,1.965,1.359.823,2.4.489,1.055,2.132,1.357-.493.3h-.489l-.821-.153-.167-.3-.981-.9-1.48-.6-1.148-.9-1.64-.454.165-.9-.493-.9.658-.9-.329-.3v-.9h-.654l-.656-.153-.659.3-.652.3.49,1.658-.165.753.326.895-.652.3.325,1.958.656.154.329.448.324,1.509.495.148v1.2l-.33,1.957.329.748.655.754.656.9.167.6h.652l.824,1.356,1.964,1.5,1.315.3.983-.155.981.308.334-.453,1.311.6,1.314,1.5v2.259l-.493,2.557-1.807.147-.82,1.2v1.055l.819,1.65,1.148,3.615.819.756,1.64.749,1.148,1.056,2.952,3.76.492,1.355,2.951,3.008.489,1.5,2.468,1.656,2.784,3.307,2.3.149.325,2.41-.66.6.827,1.951,2.129,1.056,1.477.147.49.909-.492,2.4v1.054l-.166.448.819,1.505-.327,1.054.326,1.5-.655,2.557.163,1.05,2.13.455,1.149,1.656,8.868.151,1.141.6,4.1.457,1.475-.454,2.628.756,1.969,1.8,1.639.6,1.312,2.859,1.146.9,2.958.75.325.154,2.133.448.66.3,4.428-.3,1.312.6,1.637,3.315v.6l-.491,1.055,2.3,1.048.652-.9,1.15-.448,1.477.449,2.788,2.258.982.749.988.3,2.784,2.714,1.8,1.047,2.628,2.559,3.442,6.02.493,2.257-.494,1.35.814,1.8-.488.454v.9l.327.3.659-.752.33-.147,1.31,1.055.163,1.048-1.312-1.048h-.329l.328.448.655.9V316.5l18.543-1.793,25.1-2.246,2.631-.039.664-.534.507-1.508.836-.941-.007-2.552-1.032-1.049-2.3-.149-.777-.607-.171-1.063.314-2.837-.861-.869.387-1.108-.159-1,.655-.515,1.6-1.474-.34-.581.983-.2.822-1.95-.34-1.449.513-.648L467,287.334l1.6-1.469-.181-.452.725-1.343,4.379-3.478.974-.341-.141-.734-4.279-3.475-1.487-5.111-2.289-2.1.551-1.049-1.142-.581-.518-1.7.015-1.2Z" transform="translate(-209.125 -119.734)" fill="#ffbf00"/>
      <g id="Group_1638" data-name="Group 1638" transform="translate(109.547 47.615)">
        <path id="Path_1800" data-name="Path 1800" d="M365.863,237.344l-11.094,5.832,2.119-12.352-8.975-8.748,12.4-1.8,5.547-11.239,5.547,11.239,12.4,1.8-8.975,8.748,2.119,12.352Z" transform="translate(-345.499 -206.496)" fill="#fff"/>
        <path id="Path_1801" data-name="Path 1801" d="M363.979,209.591l4.8,9.727,10.735,1.56-7.768,7.572,1.834,10.692-9.6-5.048-9.6,5.048,1.834-10.692-7.768-7.572,10.735-1.56,4.8-9.727m0-5.076-2.015,4.082-4.278,8.668-9.566,1.39-4.5.655,3.26,3.177,6.922,6.747-1.634,9.527-.769,4.487,4.029-2.118,8.556-4.5,8.556,4.5,4.029,2.118-.769-4.487-1.634-9.527,6.923-6.747,3.259-3.177-4.5-.655-9.566-1.39-4.278-8.668-2.015-4.082Z" transform="translate(-343.615 -204.515)" fill="#06203f"/>
      </g>
      <g id="Group_1641" data-name="Group 1641" transform="translate(0 69.521)">
        <g id="Group_1639" data-name="Group 1639" transform="translate(184.293 22.131)">
        <path id="Path_1802" data-name="Path 1802" d="M483.043,303.162c-2.276,0-3.956-1.641-4.279-4.18a10.286,10.286,0,0,1,.914-5.332c1.939-4.878,6.16-8.725,9.6-8.725,2.312,0,3.951,1.6,4.279,4.18a10.751,10.751,0,0,1-.9,5.441C490.742,299.363,486.513,303.162,483.043,303.162Z" transform="translate(-477.579 -283.802)" fill="#fff"/>
        <path id="Path_1803" data-name="Path 1803" d="M488.4,285.172c1.765,0,2.912,1.213,3.164,3.2a9.58,9.58,0,0,1-.815,4.852c-1.754,4.412-5.605,7.94-8.583,7.94-1.764,0-2.926-1.323-3.164-3.2a9.208,9.208,0,0,1,.829-4.742c1.753-4.411,5.591-8.05,8.568-8.05m0-2.247c-3.336,0-8.194,3.306-10.643,9.434a11.375,11.375,0,0,0-.983,5.89c.393,3.086,2.56,5.16,5.393,5.16,3.954,0,8.531-4.006,10.657-9.324a11.9,11.9,0,0,0,.969-6c-.4-3.135-2.515-5.161-5.393-5.161Z" transform="translate(-476.703 -282.925)" fill="#06203f"/>
        </g>
        <g id="Group_1640" data-name="Group 1640" transform="translate(0 0)">
          <path id="Path_1804" data-name="Path 1804" d="M276.36,379.369a22.508,22.508,0,0,1-3.346-.24c-6.5-.912-11.564-5.026-13.22-10.524a30.879,30.879,0,0,1-23.024,10.764,22.462,22.462,0,0,1-3.342-.239c-7.343-1.029-12.847-6.143-13.686-12.721a16.82,16.82,0,0,1,1.295-8.856l.027-.067.036-.063c6.218-10.847,19.8-15.27,32.941-19.547,1.49-.485,2.978-.97,4.454-1.464.177-.859.341-1.66.485-2.375-2.9,2.273-6.857,4.1-10.41,4.1a8.411,8.411,0,0,1-4.354-1.159,7.681,7.681,0,0,1-2.669-2.842,22.2,22.2,0,0,1-15.539,7.426c-.19.007-.376.01-.562.01-6.478,0-11.357-4.121-12.138-10.254a18.791,18.791,0,0,1,.815-7.28c.024-.1.829-3.378,4.137-12.94l-.458-.035c-.611-.047-1.448-.112-1.621-.112a67.266,67.266,0,0,1-11.055-1.719c-13.32,20.056-21.824,31.389-38.666,31.389-5,0-9.158-1.748-12.033-5.055-3.17-3.647-4.454-8.945-3.615-14.917a30.592,30.592,0,0,1,11.454-19.717c6.319-5.011,13.021-7.149,22.411-7.149a78.488,78.488,0,0,1,12.553,1.314c1.369.221,2.67.431,3.857.589,14.733-20.987,21.83-29.792,28.254-34.845-3.947-1.729-8.729-3.641-14.191-3.641-11.452,0-15.5,7.054-16.056,10.824-.135,2.015-2.634,2.918-5.075,2.918-.855,0-2.954-.128-3.984-1.313a2.147,2.147,0,0,1-.521-1.728,24.342,24.342,0,0,1,10.5-16.635,34.123,34.123,0,0,1,19.367-5.749,74.368,74.368,0,0,1,21.656,3.345,30.443,30.443,0,0,0,7.428,1.528,14.592,14.592,0,0,0,6.8-1.816,9.038,9.038,0,0,1,3.866-1.193,3.18,3.18,0,0,1,2.526.978,4.085,4.085,0,0,1,.64,3.3,6.8,6.8,0,0,1-2.683,4.188l-.094.078c-1.5,1.361-5.083,4.734-6.358,6.209-3.175,3.636-6.552,7.929-9.894,16.858l-4.452,11.871c1.026-.721,1.826-1.327,2.276-1.7a1.85,1.85,0,0,1,1.231-.472c1.107,0,2.134.994,2.819,2.726,1.038,2.629,1.062,6.24-1.226,8.379a42.2,42.2,0,0,1-10.816,7.6l-.513,1.426c-.4,1.164-.777,2.249-1.087,3.136-.924,3.132-3.379,11.1-3.4,11.177-1.087,3.789-.445,6.032.334,6.349a3.769,3.769,0,0,0,1.6.365c4.679,0,9.807-9.138,11.512-14.03.3-1,.643-1.966,1-2.823,4.321-10.7,13.968-21.539,24.039-21.539h.162a7.968,7.968,0,0,1,5.032,1.465l.061-.145a2.08,2.08,0,0,1,1.93-1.616,1.925,1.925,0,0,1,.355.034,5.3,5.3,0,0,0,.956.071c2.841,0,7.74-1.257,9.037-2.321a1.48,1.48,0,0,1,.944-.354,1.413,1.413,0,0,1,1.217.727,2.292,2.292,0,0,1,0,2.149c-7.039,12.518-11.006,26.327-14.141,39.543a37.889,37.889,0,0,0,7.34-4.728,38.03,38.03,0,0,1,2.651-13.289c4.321-10.7,13.968-21.538,24.039-21.538h.162a7.966,7.966,0,0,1,5.032,1.466l.062-.145a2.079,2.079,0,0,1,1.929-1.616,1.921,1.921,0,0,1,.355.034,5.3,5.3,0,0,0,.956.071c2.841,0,7.74-1.257,9.037-2.32a1.478,1.478,0,0,1,.944-.354,1.414,1.414,0,0,1,1.217.728,2.291,2.291,0,0,1,0,2.149c-7.037,12.515-11,26.325-14.137,39.541a36.853,36.853,0,0,0,7.878-5.2,18.459,18.459,0,0,1,.65-5.139c.8-3.894,4.6-14.151,10.171-27.47a2.26,2.26,0,0,1,2.111-1.763,2.055,2.055,0,0,1,.3.023,7.647,7.647,0,0,0,1.062.066c3.171,0,7.854-1.359,9.279-2.692a1.5,1.5,0,0,1,1.036-.436,1.409,1.409,0,0,1,1.2.686,2.638,2.638,0,0,1,.1,2.341c-.9,1.933-1.829,3.87-2.752,5.8-3.659,7.664-7.444,15.589-9.613,22.8-.985,3.433.4,5.927,1.455,6.355a3.7,3.7,0,0,0,1.562.365c1.3,0,2.674-.767,4.095-2.282-.009-.07-.019-.139-.028-.209-.936-7.341,2.287-16.221,8.409-23.173,5.514-6.261,12.394-9.852,18.876-9.852,5.26,0,8.451,2.307,8.985,6.5,1.491,11.71-12.982,22.81-21.805,25.973l.014.376c.3,3.76,2.421,5.534,6.668,5.534a12.917,12.917,0,0,0,7.545-2.514,11.448,11.448,0,0,1,2.924-8.128c4.93-5.521,11.011-16.674,14.475-24.843a17.807,17.807,0,0,0,1.234-3.429,6.429,6.429,0,0,1,6.334-5.517,6.229,6.229,0,0,1,2.8.663c2.555,1.447,3.279,4.222,1.939,7.271a7.511,7.511,0,0,1-2.153,3c-.115.107-.227.213-.339.322l-.16.181a3.313,3.313,0,0,0-1.065,1.939c-.1,1.044.406,1.664,1.381,2.756.231.259.468.525.7.807.6.737,1.271,1.465,1.98,2.236,2.651,2.882,5.657,6.149,6.319,11.347a20.1,20.1,0,0,1-2.017,11.753,14.92,14.92,0,0,0,4.351-4.123,48.028,48.028,0,0,0,5.353-10.789,1.867,1.867,0,0,1,1.932-1.307,6.5,6.5,0,0,1,4.473,2.474,4.277,4.277,0,0,1,.943,3.719,30.5,30.5,0,0,1-9,15.682,20.7,20.7,0,0,1-13.021,5.25,13.16,13.16,0,0,1-5.465-1.1,23.819,23.819,0,0,1-9.311,1.984,17.952,17.952,0,0,1-7.368-1.531,12.369,12.369,0,0,1-3.124-1.989,29.18,29.18,0,0,1-14.154,3.41c-6.041,0-11.115-1.924-14.433-5.444a19.6,19.6,0,0,1-12,4.507q-.283.01-.561.01a11.968,11.968,0,0,1-10.324-5.22,39.622,39.622,0,0,1-11.951,7.232c-1.99,8.828-3.735,16.45-6.207,21.932C298.04,374.044,285.956,379.369,276.36,379.369Zm19.97-34.825c-12.921,4.667-21.2,9.773-22.287,13.793-.747,2.766-.573,4.969.5,6.373a5.084,5.084,0,0,0,4.157,1.732,10.294,10.294,0,0,0,2.817-.422c2.1-.568,9.11-2.932,11.687-9.7A106.107,106.107,0,0,0,296.331,344.544Zm-39.585,0c-12.922,4.668-21.2,9.774-22.287,13.793-.747,2.766-.574,4.969.5,6.373a5.086,5.086,0,0,0,4.157,1.732,10.3,10.3,0,0,0,2.817-.422c2.1-.568,9.11-2.932,11.687-9.7A106.3,106.3,0,0,0,256.746,344.544Zm13.279-4.327c-.72,3.192-1.415,6.26-2.13,9.137,6.968-5.367,16.5-8.471,25.753-11.485q2.225-.724,4.434-1.457c.177-.859.341-1.66.486-2.375-2.9,2.273-6.857,4.1-10.41,4.1a8.415,8.415,0,0,1-4.355-1.159,7.79,7.79,0,0,1-2.828-3.141A40.087,40.087,0,0,1,270.025,340.217Zm110.87-7.912a5.42,5.42,0,0,0,1.287.169l.185,0c2.4,0,8.1-1.118,9.24-11.463a27.5,27.5,0,0,0-.108-5.8,20.95,20.95,0,0,0-1.431-5.543,46.672,46.672,0,0,1-6.02,10.214,6.859,6.859,0,0,1,1.784,7.422A7.015,7.015,0,0,1,380.895,332.305ZM182.573,304.79c-9.905,0-21.071,4.136-22.7,15.743-.443,3.149-.016,5.494,1.268,6.971,1.324,1.524,3.707,2.3,7.08,2.3,8.028,0,14.883-7.866,25.227-23.36A40.461,40.461,0,0,0,182.573,304.79Zm124.306-5.8c-3.137,0-9.06,3.473-12.517,13.043-1.911,4.959-2.043,8.087-1.819,9.843.133,1.041.573,2.847,2.034,3.25a4.139,4.139,0,0,0,1.165.154,6.032,6.032,0,0,0,5.847-4.431c.039-.138,3.195-10.853,6.414-19.3l.024-.057a2.054,2.054,0,0,0,.092-1.925A1.425,1.425,0,0,0,306.879,298.989Zm-39.585,0c-3.137,0-9.06,3.473-12.516,13.043-1.911,4.957-2.044,8.086-1.82,9.843.133,1.041.573,2.847,2.034,3.25a4.146,4.146,0,0,0,1.165.154A6.032,6.032,0,0,0,262,320.848c.04-.138,3.2-10.853,6.414-19.3l.024-.057a2.055,2.055,0,0,0,.092-1.925A1.425,1.425,0,0,0,267.294,298.989Zm101.2-.441c-4.093,0-10.048,10.394-12.4,16.621a46.8,46.8,0,0,0,7.968-5.948c2.718-2.565,5.865-6.365,5.415-9.89C369.424,298.924,369.269,298.548,368.491,298.548Zm-157.27-.6a64.313,64.313,0,0,0,6.934.667,23.684,23.684,0,0,0,4.626-.3c1.311-3.592,8.026-21.978,9.206-25.067a39.569,39.569,0,0,1,3.414-6.721,74.709,74.709,0,0,0-7.351,7.549c-1.1,1.329-2.305,2.837-3.672,4.6-2.922,3.876-5.613,7.958-8.216,11.905C214.563,293.005,212.92,295.5,211.221,297.947Z" transform="translate(-149.439 -244.396)" fill="#fff"/>
          <path id="Path_1805" data-name="Path 1805" d="M218.509,245.766a73.4,73.4,0,0,1,21.352,3.3,31.039,31.039,0,0,0,7.731,1.57,15.758,15.758,0,0,0,7.288-1.926,8.123,8.123,0,0,1,3.381-1.084c1.86,0,2.318,1.112,2.053,2.994a5.776,5.776,0,0,1-2.281,3.474l-.1.08c-1.6,1.447-5.169,4.811-6.494,6.342-3.139,3.594-6.662,8.022-10.1,17.2l-5.255,14.014-.373,1.094a57.929,57.929,0,0,0,5.227-3.688.753.753,0,0,1,.508-.208c1.722,0,3.881,6.3.826,9.164a41.446,41.446,0,0,1-10.956,7.608l-.078.23-.585,1.626c-.406,1.177-.781,2.26-1.09,3.147-.949,3.214-3.416,11.216-3.416,11.216-1.153,4.02-.644,7.057.984,7.72a4.837,4.837,0,0,0,2.018.447c5.809,0,11.124-10.629,12.573-14.783.3-1,.632-1.934.974-2.764,4.253-10.531,13.662-20.845,23-20.844h.148c4.412,0,5.382,2.427,5.382,2.427l.795-1.875c.062-.3.349-.847.859-.847a.766.766,0,0,1,.145.014,6.421,6.421,0,0,0,1.166.09c2.974,0,8.173-1.284,9.749-2.575a.372.372,0,0,1,.231-.1c.348,0,.483.769.24,1.2-7.653,13.611-11.693,28.763-14.791,42.124a41.462,41.462,0,0,0,10.1-6.246,36.357,36.357,0,0,1,2.562-13.372c4.253-10.531,13.662-20.845,23-20.844h.149c4.411,0,5.382,2.427,5.382,2.427l.795-1.875c.062-.3.349-.847.859-.847a.766.766,0,0,1,.145.014,6.422,6.422,0,0,0,1.167.09c2.974,0,8.173-1.284,9.749-2.575a.372.372,0,0,1,.231-.1c.349,0,.483.769.24,1.2-7.651,13.609-11.691,28.761-14.789,42.124a40.331,40.331,0,0,0,10.645-6.741,17.509,17.509,0,0,1,.606-5.362c.763-3.75,4.514-13.911,10.149-27.384a1.185,1.185,0,0,1,1.04-.988,1.019,1.019,0,0,1,.139.01,8.8,8.8,0,0,0,1.222.078c3.315,0,8.342-1.4,10.045-2.995a.407.407,0,0,1,.269-.133c.38,0,.53.9.285,1.428-4.577,9.787-9.691,19.67-12.423,28.755-1.153,4.02.479,7.058,2.107,7.72a4.76,4.76,0,0,0,1.985.447c1.926,0,3.712-1.245,5.288-3.048-.038-.233-.076-.467-.106-.706-1.771-13.9,12.054-31.761,26.17-31.761,3.749,0,7.323,1.214,7.871,5.514,1.4,11.028-12.725,22.167-21.844,25.034l.044,1.213c.37,4.632,3.269,6.616,7.791,6.616a14.277,14.277,0,0,0,8.69-3.084v0a10.429,10.429,0,0,1,2.628-7.94c4.826-5.4,11.015-16.542,14.662-25.144a18.375,18.375,0,0,0,1.3-3.639,5.287,5.287,0,0,1,5.234-4.622,5.079,5.079,0,0,1,2.3.541c2.139,1.212,2.435,3.529,1.406,5.845a7.423,7.423,0,0,1-2.267,2.978,4.747,4.747,0,0,0-1.524,2.756c-.188,1.985,1.151,2.978,2.326,4.412,2.877,3.529,7.268,6.837,8.055,13.012a19.263,19.263,0,0,1-2.246,11.8c-.261.551-.329.882-.08,1.1a.549.549,0,0,0,.476.165,2.693,2.693,0,0,0,.848-.165,14.371,14.371,0,0,0,5.351-4.743,49.093,49.093,0,0,0,5.529-11.138c.095-.35.416-.507.857-.507,1.644,0,4.947,2.2,4.323,4.808A29.334,29.334,0,0,1,409.7,331.4a19.658,19.658,0,0,1-12.27,4.962,11.9,11.9,0,0,1-5.448-1.213,22.77,22.77,0,0,1-9.327,2.1,16.942,16.942,0,0,1-6.91-1.433,11.333,11.333,0,0,1-3.424-2.351,27.785,27.785,0,0,1-14.312,3.675c-5.72,0-11.033-1.807-14.321-5.9a18.559,18.559,0,0,1-12.155,4.966c-.175.006-.348.009-.52.009-4.671,0-8.322-2.257-10.044-5.891a38.089,38.089,0,0,1-13.2,8.191c-2.029,9-3.8,16.838-6.267,22.305-5.388,11.946-17.368,16.56-26.022,16.56a21.415,21.415,0,0,1-3.177-.227c-6.947-.974-11.974-5.742-12.739-11.753-.015-.112-.021-.227-.033-.34-6.03,8.81-16.1,12.319-23.64,12.319a21.361,21.361,0,0,1-3.173-.226c-6.947-.974-11.973-5.742-12.739-11.753A15.761,15.761,0,0,1,221.2,357.1c6.781-11.829,22.769-15.787,37.389-20.709.784-3.776,1.318-6.542,1.318-6.542-2.281,2.867-7.58,6.286-12.212,6.286a6.715,6.715,0,0,1-6.718-4.925c-3.718,4.5-9,8.1-15.884,8.351-.176.006-.349.009-.522.009-5.988,0-10.314-3.7-11.025-9.273a17.891,17.891,0,0,1,.783-6.837s.8-3.29,4.175-13.046c.139-.4.271-.779.4-1.162l-.217-.075h-.013c-.42,0-2.946-.227-3.375-.227-2.314,0-7.288-.941-11.569-1.853-13.744,20.723-21.993,31.524-38.152,31.524-10.1,0-16.082-7.686-14.535-18.693a29.468,29.468,0,0,1,11.04-18.992c6.256-4.961,12.825-6.906,21.713-6.906,6.15,0,12.217,1.4,16.719,1.951l.223.028c15.251-21.747,22.812-31.258,29.938-36.3l-.684-.3c-4.241-1.876-9.519-4.211-15.72-4.211-12.27,0-16.6,7.743-17.176,11.837-.052,1.268-2.053,1.905-3.956,1.905-1.824,0-3.557-.586-3.392-1.761a23.234,23.234,0,0,1,10.031-15.869,33,33,0,0,1,18.726-5.548m-1.231,53.095a24.25,24.25,0,0,0,5.46-.43s8.107-22.217,9.421-25.657a30.476,30.476,0,0,1,7.744-11.754,25.091,25.091,0,0,0-5.081,2.884,75.405,75.405,0,0,0-8.5,8.569c-1.133,1.368-2.359,2.9-3.7,4.639-5.125,6.8-9.367,13.95-14.225,20.792a70.079,70.079,0,0,0,8.89.958M353.3,316.62c5.6-2.758,17.342-11.029,16.415-18.307a1.921,1.921,0,0,0-2.1-1.764c-5.845,0-13.17,15.219-14.316,20.071m-58.432,8.906a7.188,7.188,0,0,0,6.933-5.268s3.137-10.684,6.377-19.189c1.1-2.462-.3-4.08-2.174-4.08-3.86,0-10.067,4.08-13.573,13.785-1.657,4.3-2.2,7.83-1.877,10.366.281,2.206,1.25,3.749,2.85,4.191a5.237,5.237,0,0,0,1.464.195m-39.585,0a7.188,7.188,0,0,0,6.933-5.268s3.138-10.684,6.377-19.189c1.1-2.462-.3-4.08-2.174-4.08-3.86,0-10.067,4.08-13.572,13.785-1.658,4.3-2.2,7.83-1.878,10.366.281,2.206,1.25,3.749,2.85,4.191a5.237,5.237,0,0,0,1.464.195m-87.938,4.522c8.6,0,15.742-8.124,27.022-25.156a45.33,45.33,0,0,0-12.669-2.1c-15.827,0-22.679,8.632-23.814,16.711-1,7.1,2.1,10.547,9.461,10.547m210.319.592a6.13,6.13,0,0,1-1.269-.125,6.544,6.544,0,0,0,4.913,2.206l.185,0c6.29,0,9.6-5.583,10.358-12.463a28.684,28.684,0,0,0-.111-6.066,19.183,19.183,0,0,0-2.68-8.05,44.94,44.94,0,0,1-7.495,13.013,5.761,5.761,0,0,1,2.319,6.947,6.174,6.174,0,0,1-6.219,4.537m-90.381,5.5a6.727,6.727,0,0,1-6.754-5.032,38.429,38.429,0,0,1-12.342,7.4c-1.078,4.783-2.084,9.237-3.16,13.179,7.975-7.788,21.03-11.208,33.149-15.289.785-3.776,1.319-6.542,1.319-6.542-2.281,2.867-7.581,6.286-12.212,6.286m-9.456,30.55a11.441,11.441,0,0,0,3.125-.465c4.646-1.254,10.2-4.534,12.428-10.378a128.3,128.3,0,0,0,3.613-13.914c-10.715,3.706-23.37,9.539-24.909,15.235-1.748,6.469,1.364,9.522,5.742,9.522m-39.585,0a11.442,11.442,0,0,0,3.126-.465c4.646-1.254,10.2-4.534,12.428-10.378a128.444,128.444,0,0,0,3.614-13.914c-10.715,3.706-23.37,9.539-24.909,15.235-1.748,6.469,1.364,9.522,5.742,9.522m-19.731-123.17a35.262,35.262,0,0,0-20.01,5.95,25.455,25.455,0,0,0-10.972,17.4,3.253,3.253,0,0,0,.785,2.621c1.285,1.479,3.579,1.7,4.832,1.7,3.537,0,6-1.567,6.192-3.915.525-3.444,4.293-9.827,14.94-9.827a31.354,31.354,0,0,1,12.053,2.824c-6.108,5.254-13.181,14.181-26.642,33.333-.986-.141-2.048-.313-3.154-.492a79.358,79.358,0,0,0-12.731-1.328c-9.664,0-16.575,2.211-23.109,7.393a31.7,31.7,0,0,0-11.868,20.44c-.886,6.3.493,11.914,3.88,15.811,3.095,3.56,7.548,5.442,12.88,5.442,8.363,0,14.993-2.646,21.5-8.578,5.92-5.4,11.541-13.448,17.685-22.681a63.746,63.746,0,0,0,10.541,1.589c.078,0,.288.015.543.033-2.785,8.136-3.592,11.261-3.692,11.661a19.8,19.8,0,0,0-.839,7.69c.857,6.722,6.183,11.236,13.253,11.236q.3,0,.6-.011a22.9,22.9,0,0,0,15.333-6.773,8.456,8.456,0,0,0,2.248,2.023,9.062,9.062,0,0,0,3.152,1.168c-10.973,3.8-21.333,8.475-26.655,17.759l-.072.126-.056.134a18.141,18.141,0,0,0-1.37,9.426c.9,7.087,6.793,12.59,14.656,13.693a23.571,23.571,0,0,0,3.485.248,32.245,32.245,0,0,0,22.629-9.746c2.254,4.991,7.244,8.625,13.472,9.5a23.536,23.536,0,0,0,3.489.249c9.957,0,22.5-5.53,28.07-17.883,2.464-5.464,4.2-12.926,6.148-21.568a40.969,40.969,0,0,0,10.8-6.411,13.249,13.249,0,0,0,10.517,4.7c.2,0,.4,0,.6-.011a20.672,20.672,0,0,0,11.875-4.134c3.52,3.287,8.586,5.072,14.521,5.072a30.61,30.61,0,0,0,14.021-3.189,13.488,13.488,0,0,0,2.806,1.674,19.062,19.062,0,0,0,7.819,1.625,24.848,24.848,0,0,0,9.308-1.889,14.387,14.387,0,0,0,5.468,1.006,21.834,21.834,0,0,0,13.742-5.512l.015-.013.015-.014a31.716,31.716,0,0,0,9.353-16.293,5.437,5.437,0,0,0-1.163-4.639,7.6,7.6,0,0,0-5.354-2.9,3,3,0,0,0-3.013,2.121,47.02,47.02,0,0,1-5.191,10.45q-.411.548-.815,1.018a20.67,20.67,0,0,0,.513-8.142c-.707-5.553-3.979-9.108-6.607-11.964-.7-.758-1.356-1.474-1.934-2.183-.254-.311-.5-.584-.734-.847-.907-1.017-1.143-1.348-1.1-1.9.063-.464.245-.689.787-1.3l.133-.151c.1-.093.194-.185.293-.277a8.6,8.6,0,0,0,2.425-3.4c1.552-3.558.622-6.948-2.379-8.648l-.045-.026-.047-.024a7.358,7.358,0,0,0-3.311-.784,7.545,7.545,0,0,0-7.442,6.449,16.83,16.83,0,0,1-1.166,3.192c-3.339,7.876-9.476,19.15-14.265,24.513a12.431,12.431,0,0,0-3.217,8.29,11.661,11.661,0,0,1-6.424,1.989c-4.218,0-5.225-1.957-5.5-4.026a43.045,43.045,0,0,0,14.123-9.43c5.621-5.652,8.324-11.847,7.612-17.445-.606-4.751-4.287-7.476-10.1-7.476-6.8,0-13.992,3.73-19.719,10.233-6.237,7.083-9.558,16.139-8.719,23.725a4.649,4.649,0,0,1-2.913,1.559,2.519,2.519,0,0,1-1.056-.246l-.042-.019-.042-.017c-.4-.185-1.659-1.983-.8-5.005,2.145-7.127,5.909-15.01,9.55-22.634.908-1.9,1.847-3.867,2.752-5.8a3.741,3.741,0,0,0-.175-3.42,2.545,2.545,0,0,0-2.145-1.206,2.6,2.6,0,0,0-1.8.737c-1.115,1.044-5.442,2.39-8.511,2.39a6.547,6.547,0,0,1-.905-.055,3.193,3.193,0,0,0-.456-.033,3.378,3.378,0,0,0-3.175,2.515c-5.563,13.311-9.367,23.6-10.2,27.578a19.546,19.546,0,0,0-.68,4.891,33.439,33.439,0,0,1-5.074,3.524c3.026-12.383,6.9-25.176,13.436-36.809a3.384,3.384,0,0,0-.011-3.266,2.524,2.524,0,0,0-2.186-1.284,2.594,2.594,0,0,0-1.656.608c-1.019.835-5.579,2.066-8.325,2.066a4.171,4.171,0,0,1-.747-.051,2.984,2.984,0,0,0-3,1.216,10.032,10.032,0,0,0-4.6-.974h-.149c-10.568,0-20.618,11.193-25.084,22.249a38.716,38.716,0,0,0-2.723,13.167,34.2,34.2,0,0,1-4.542,3.08c3.027-12.383,6.9-25.177,13.439-36.81a3.385,3.385,0,0,0-.011-3.267,2.525,2.525,0,0,0-2.186-1.283,2.6,2.6,0,0,0-1.656.608c-1.019.835-5.579,2.066-8.325,2.066a4.172,4.172,0,0,1-.748-.051,2.985,2.985,0,0,0-3,1.215,10.04,10.04,0,0,0-4.6-.973H265.7c-10.569,0-20.619,11.193-25.085,22.249-.356.862-.7,1.845-1.027,2.908-1.676,4.773-6.572,13.235-10.437,13.235a2.581,2.581,0,0,1-1.073-.239c-.209-.315-.678-1.879.225-5.041.144-.469,2.474-8.028,3.4-11.167.3-.875.673-1.937,1.07-3.088l.019-.051.337-.936a43.481,43.481,0,0,0,10.7-7.606c2.647-2.5,2.652-6.615,1.479-9.589-.863-2.184-2.271-3.438-3.863-3.438a2.923,2.923,0,0,0-1.159.237l3.155-8.413c3.275-8.753,6.581-12.956,9.685-16.51,1.147-1.327,4.415-4.44,6.269-6.118l.057-.047a7.958,7.958,0,0,0,3.079-4.9,5.248,5.248,0,0,0-.9-4.189,4.249,4.249,0,0,0-3.373-1.365,10.026,10.026,0,0,0-4.35,1.3,13.653,13.653,0,0,1-6.319,1.706,29.915,29.915,0,0,1-7.124-1.486,75.359,75.359,0,0,0-21.959-3.387Zm9.529,30.4q1.134-1.332,2.28-2.569c-.08.189-.159.381-.239.576l-.01.024-.01.024c-1.142,2.988-7.25,19.709-8.984,24.46a24.467,24.467,0,0,1-3.8.183c-.838,0-2.781-.151-4.971-.417,1.338-1.964,2.64-3.94,3.914-5.872,2.59-3.929,5.269-7.992,8.176-11.849,1.353-1.744,2.544-3.236,3.641-4.56ZM357.7,311.36a56.671,56.671,0,0,1,2.908-5.421c3.14-5.12,5.646-7.033,6.9-7.139.3,3.825-4.594,8.885-9.8,12.56Zm-62.835,11.92a3.025,3.025,0,0,1-.832-.1l-.017-.005-.017,0c-.865-.239-1.14-1.694-1.218-2.309-.294-2.3.326-5.593,1.744-9.274l.008-.022.008-.022c3.237-8.962,8.747-12.3,11.46-12.3a.513.513,0,0,1,.3.068,1.381,1.381,0,0,1-.18.852l-.025.056-.022.058c-3.234,8.489-6.4,19.248-6.433,19.356l-.009.03-.008.03a4.941,4.941,0,0,1-4.761,3.594Zm-39.585,0a3.026,3.026,0,0,1-.832-.1l-.017-.005-.017,0c-.865-.239-1.14-1.694-1.218-2.309-.293-2.3.326-5.594,1.745-9.274l.008-.022.008-.022c3.237-8.962,8.747-12.3,11.459-12.3a.517.517,0,0,1,.3.068,1.383,1.383,0,0,1-.18.852l-.025.056-.022.058c-3.234,8.489-6.4,19.248-6.433,19.356l-.009.029-.008.03a4.941,4.941,0,0,1-4.761,3.594ZM167.343,327.8c-3.034,0-5.131-.642-6.233-1.91-1.061-1.221-1.4-3.266-1-6.078a15.76,15.76,0,0,1,5.6-9.966c3.863-3.192,9.242-4.811,15.986-4.811a36.808,36.808,0,0,1,9.055,1.217C179.9,322.3,173.847,327.8,167.343,327.8Zm217.312-8.865a46.659,46.659,0,0,0,4.358-7.128,23.015,23.015,0,0,1,.5,2.668,26.474,26.474,0,0,1,.1,5.566c-.29,2.585-1.344,7.912-5.14,9.773a8.593,8.593,0,0,0,1.566-3.084,8.075,8.075,0,0,0-1.383-7.8ZM270.113,340.165a41.457,41.457,0,0,0,9.685-5.526,8.522,8.522,0,0,0,2.54,2.421,9.055,9.055,0,0,0,3.155,1.169c-5.974,2.07-11.778,4.4-16.68,7.6.432-1.831.862-3.725,1.3-5.666Zm7.712,24.277a4.021,4.021,0,0,1-3.265-1.292c-.842-1.1-.952-3.017-.309-5.4.91-3.366,8.472-8.062,19.643-12.309a88.784,88.784,0,0,1-2.615,9.6c-2.388,6.27-8.958,8.481-10.915,9.009l-.016,0-.016,0a9.166,9.166,0,0,1-2.507.378Zm-39.585,0a4.021,4.021,0,0,1-3.265-1.292c-.842-1.1-.951-3.017-.308-5.4.909-3.366,8.471-8.06,19.643-12.308a88.99,88.99,0,0,1-2.616,9.6c-2.388,6.27-8.957,8.481-10.914,9.008l-.016,0-.016,0a9.177,9.177,0,0,1-2.508.378Z" transform="translate(-148.562 -243.519)" fill="#06203f"/>
        </g>
      </g>
    </svg>
    `;
  }

}

customElements.define('ucdlib-site-footer', UcdlibSiteFooter);
