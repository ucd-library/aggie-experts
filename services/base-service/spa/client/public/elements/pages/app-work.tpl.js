import { html } from 'lit';

import { sharedStyles } from '../styles/shared-styles';

export function render() {
return html`
  <style>
    ${sharedStyles}
    :host {
      display: block;
    }

    .hero-main {
      background: url('../images/watercolor-sage-solid.jpg') no-repeat center center;
      background-size: 100% auto;
      background-color: #F2FAF6;
      width: 100%;

      /* min-height: 500px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background-position: bottom;
      background-repeat: no-repeat;
      background-size: cover; */
    }

    .color-light {
      color: white;
    }

    .content {
      width: 100%;
      margin: 0 auto;
      min-height: 700px;
    }

    .main-content {
      width: 60%;
      margin: 0 auto;
      padding-top: 2.38rem;
    }

    .hero-text {
      padding: 2.625rem 2.625rem 4.1875rem 2.625rem;
    }

    .article span {
      color: var(--color-black-60);
      padding-left: .5rem;
      font-size: 1rem;
    }

    .hero-text .article {
      display: flex;
      align-items: center;
    }

    h1 {
      margin-top: .5rem;
      margin-bottom: 0;
      padding-bottom: 0;
      color: var(--color-aggie-blue);
    }

    .authors a {
      color: var(--color-aggie-blue);
    }

    .authors {
      margin-bottom: 0;
      margin-top: 0.5rem;
    }

    svg {
      fill: var(--color-sage);
    }

    .main-content .article {
      display: flex;
      align-items: center;
      margin-bottom: 0;
    }

    .main-content .article svg {
      font-size: 2rem;
    }

    .main-content svg {
      fill: var(--color-aggie-blue-60);
    }

    .main-content h2 {
      padding: 0 0 0 1rem;
      margin-bottom: 0;
      margin-top: 0;
      color: var(--color-black-60);
    }

    .main-content .abstract {
      margin-top: 2.38rem;
    }

    .seperator {
      /* border-top: 4px dotted var(--color-sage); */
      display: block;
      height: 4px;
      border: 0;
      border-top: 4px dotted var(--color-sage);
      /* margin: 1em 0; */
      padding: 0;
      margin: 0.625rem 0;
    }

    .full-text h4,
    .abstract h4,
    .published h4 {
      margin: 0.7rem 0;
    }

    .full-text .link-row {
      display: flex;
      align-items: center;
      line-height: 2rem;
    }

    .full-text .link-row svg {
      min-width: 25px;
    }

    .full-text .link-row span {
      padding-left: 0.625rem;
    }

  </style>

  <div class="content">
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="article">
        <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M249.6 471.5c10.8 3.8 22.4-4.1 22.4-15.5V78.6c0-4.2-1.6-8.4-5-11C247.4 52 202.4 32 144 32C93.5 32 46.3 45.3 18.1 56.1C6.8 60.5 0 71.7 0 83.8V454.1c0 11.9 12.8 20.2 24.1 16.5C55.6 460.1 105.5 448 144 448c33.9 0 79 14 105.6 23.5zm76.8 0C353 462 398.1 448 432 448c38.5 0 88.4 12.1 119.9 22.6c11.3 3.8 24.1-4.6 24.1-16.5V83.8c0-12.1-6.8-23.3-18.1-27.6C529.7 45.3 482.5 32 432 32c-58.4 0-103.4 20-123 35.6c-3.3 2.6-5 6.8-5 11V456c0 11.4 11.7 19.3 22.4 15.5z"/></svg>
        <span>ARTICLE</span>
        </div>
        <h1>${this.publicationName}</h1>
        <h4 class="authors">
          <span><a href="">Author UCD</a></span>,
          <span>Author</span>,
          <span>Author</span>,
          <span><a href="">Author UCD</a></span>,
          <span>Author</span>
        </h4>
      </div>
    </div>

    <div class="main-content">
      <div class="article">
        <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M249.6 471.5c10.8 3.8 22.4-4.1 22.4-15.5V78.6c0-4.2-1.6-8.4-5-11C247.4 52 202.4 32 144 32C93.5 32 46.3 45.3 18.1 56.1C6.8 60.5 0 71.7 0 83.8V454.1c0 11.9 12.8 20.2 24.1 16.5C55.6 460.1 105.5 448 144 448c33.9 0 79 14 105.6 23.5zm76.8 0C353 462 398.1 448 432 448c38.5 0 88.4 12.1 119.9 22.6c11.3 3.8 24.1-4.6 24.1-16.5V83.8c0-12.1-6.8-23.3-18.1-27.6C529.7 45.3 482.5 32 432 32c-58.4 0-103.4 20-123 35.6c-3.3 2.6-5 6.8-5 11V456c0 11.4 11.7 19.3 22.4 15.5z"/></svg>
        <h2>About the Article</h2>
      </div>
      <hr class="seperator">

      <div class="full-text">
        <h4>Full Text</h4>
        <div class="link-row">
          <!-- <svg width="26" height="25" viewBox="0 0 26 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g id="Boxed FA Icon">
              <path id="Vector" d="M2.5 3.5V22.4583L12.4583 19.8833L22.5 22.4583V3.5H2.5ZM11.6417 12.8583C11.6417 13.9583 11.375 14.8083 10.825 15.425C10.275 16.0333 9.425 16.3417 8.30833 16.3417C7.125 16.3417 6.24167 16.0417 5.69167 15.4417C5.14167 14.8417 4.85833 14.0167 4.85833 12.9667V7.8H6.45V12.8333C6.45 13.575 6.6 14.125 6.89167 14.4667C7.18333 14.8083 7.66667 14.975 8.34167 14.975C8.96667 14.975 9.43333 14.7917 9.71667 14.4333C10.025 14.0083 10.1833 13.4917 10.1583 12.9583V7.79167H11.6417V12.8417V12.8583ZM20.1333 15.4583C20 15.575 19.8583 15.6833 19.7083 15.7667C19.5167 15.8833 19.3167 15.975 19.1083 16.05C18.8667 16.1333 18.625 16.2 18.375 16.25C18.0917 16.3083 17.8083 16.3333 17.525 16.3333C16.9 16.3417 16.2833 16.225 15.7083 15.975C15.2083 15.75 14.7583 15.425 14.3917 15.0083C14.0333 14.6 13.7667 14.125 13.5917 13.6167C13.4167 13.0917 13.325 12.5417 13.325 11.9833C13.325 11.425 13.4167 10.875 13.6 10.35C13.775 9.84167 14.0583 9.375 14.4167 8.96667C14.7917 8.55833 15.2417 8.23333 15.75 8.00833C16.3167 7.75833 16.9333 7.63333 17.55 7.64167C18.0167 7.63333 18.4833 7.69167 18.9417 7.80833C19.3167 7.91667 19.6667 8.08333 19.9917 8.29167L20.075 8.35L19.3167 9.54167L19.2333 9.48333C18.725 9.14167 18.125 8.975 17.5167 9C17.1417 8.99167 16.7667 9.06667 16.4167 9.23333C16.1083 9.38333 15.8417 9.6 15.625 9.86667C15.4083 10.1417 15.2417 10.4583 15.1417 10.7917C15.0333 11.1583 14.975 11.5333 14.9833 11.9167C14.9833 12.3083 15.0333 12.7 15.1417 13.0833C15.2417 13.4333 15.4 13.7667 15.625 14.0583C15.8333 14.3333 16.1083 14.5583 16.4167 14.7167C16.7667 14.8833 17.15 14.9667 17.5417 14.9583C17.9083 14.9667 18.2833 14.9083 18.625 14.775C18.9 14.6667 19.1583 14.5167 19.3917 14.325L19.4833 14.25L20.1917 15.3833L20.1333 15.4417V15.4583Z" fill="#73ABDD"/>
            </g>
          </svg> -->
          <ucdlib-icon icon="ucdlib-experts:uc-boxed"></ucdlib-icon>

          <span><a href="">Get it at UC</a></span>
        </div>
        <div class="link-row">
          <!-- <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 640 512">! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc.<path d="M256 64H384v64H256V64zM240 0c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48h48v32H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96v32H80c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48H240c26.5 0 48-21.5 48-48V368c0-26.5-21.5-48-48-48H192V288H448v32H400c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48H560c26.5 0 48-21.5 48-48V368c0-26.5-21.5-48-48-48H512V288h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V192h48c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48H240zM96 448V384H224v64H96zm320-64H544v64H416V384z"/></svg>
           -->
           <ucdlib-icon icon="ucdlib-experts:fa-network-wired"></ucdlib-icon>
           <span><a href="">Publisher Page</a></span>
        </div>
      </div>

      <div class="abstract">
        <h4>Abstract</h4>
        <ucdlib-md>
          <ucdlib-md-content>
            ${this.abstract}
          </ucdlib-md-content>
        </ucdlib-md>
      </div>

      <div class="published">
        <h4>Published</h4>
        <span>Academic Journel Title of Academic Things</span> . <span>Volume 3</span> . <span>May 31, 2022</span>
      </div>

    </div>

  </div>

`;}
