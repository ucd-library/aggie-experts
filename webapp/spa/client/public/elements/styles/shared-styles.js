import ucdCssProps from "./campus-theme-properties.css";
import ucdCss from "./campus-theme.css";

let styleEle = document.createElement('style');
styleEle.innerHTML = ucdCss + ucdCssProps;
document.head.appendChild(styleEle);

// import this for Lit elements
export const sharedStyles = `${ucdCss}`;
