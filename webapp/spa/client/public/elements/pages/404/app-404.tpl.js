import { html } from 'lit';

export default function render() {
return html`

<style>
  [hidden] {
    display: none !important;
  }
  .container-error {
    background-color:white;
    background-image: url("/images/watercolorbg.png") ;
    background-size: cover;
    -webkit-background-size: cover;
    -moz-background-size: cover;
    -o-background-size: cover;
    padding: 0 20px 40px 20px;
  }

  .topic{
    color: var(--ae-color-blue);
    font-size: 100px;
    margin: 40px 0 0 0;
  }
  .subtext1{
    font-size: 26px;
    margin-top: 40px;
    margin-bottom: 20px;
    text-align: center;
  }
  .subtext2{
    font-size: 16px;
    font-weight: normal;
    margin-bottom: 40px;
    text-align: center;
  }

  .content-space{
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
  }

  .horseImg {
    width: 500px;
    max-width: 100%;
  }

  @media(max-width: 600px) {
    .topic {
      margin: 20px 0 0 0;
    }
    .subtext1 {
      margin-top: 20px;
    }
  }

</style>

<div class="container-error">
  <div class="content-space">
    <h1 class="topic">404</h1>
    <div class="subtext1">Oh no! This page has bolted away!</div>
    <div class="subtext2">Don't worry, we'll get you <a href="/">home</a></div>

    <img class="horseImg" src="/images/gunrock-running.png" alt="Horse Image">
  </div>
</div>

`;}
