import { LitElement } from 'lit';
import {render} from "./app-faq.tpl.js";
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/brand/ucd-theme-list-accordion/ucd-theme-list-accordion.js'

export default class AppFaq extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      isLoggedIn : { type : Boolean },
      imgPath : { type : String },
      faqSections : { type : Array },
      faqLoadError : { type : String },
      faqLoaded : { type : Boolean }
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel');

    this.isLoggedIn = APP_CONFIG.user?.preferred_username ? true : false;
    this.imgPath = '/images/faq/';
    this.faqSections = [];
    this.faqLoadError = '';
    this.faqLoaded = false;

    this.render = render.bind(this);
  }

  async firstUpdated() {
    await this._loadFaqContent();
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  _slugify(text='') {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  _parseHeading(raw='', fallback='') {
    const match = raw.match(/^(.*?)\s*\{#([a-z0-9-]+)\}\s*$/i);
    if( match ) {
      return { title: match[1].trim(), id: match[2].trim() };
    }

    const title = raw.trim();
    return { title, id: this._slugify(title) || fallback };
  }

  _applyAuthBlocks(markdown='') {
    return markdown.replace(/\{\{ifLoggedIn\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/ifLoggedIn\}\}/g, (match, loggedInContent, loggedOutContent='') => {
      return this.isLoggedIn ? loggedInContent : loggedOutContent;
    });
  }

  _normalizeImagePaths(markdown='') {
    return markdown.replace(/\]\((?:\.\/)?images\//g, `](${this.imgPath}`);
  }

  _parseFaqMarkdown(markdown='') {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const sections = [];

    let currentSection = null;
    let currentQuestion = null;
    let answerBuffer = [];
    let introBuffer = [];

    const processMarkdownToHtml = (raw='') => {
      const processed = this._normalizeImagePaths(this._applyAuthBlocks(raw));
      return DOMPurify.sanitize(marked.parse(processed || ''), {
        USE_PROFILES: { html: true }
      });
    };

    const commitQuestion = () => {
      if( !currentSection || !currentQuestion ) return;

      const answerMarkdownRaw = answerBuffer.join('\n').trim();
      const answerHtml = processMarkdownToHtml(answerMarkdownRaw);

      currentSection.items.push({
        ...currentQuestion,
        answerHtml
      });

      currentQuestion = null;
      answerBuffer = [];
    };

    const commitIntro = () => {
      if( !currentSection || !introBuffer.length ) return;

      const introMarkdownRaw = introBuffer.join('\n').trim();
      if( !introMarkdownRaw ) return;

      currentSection.introHtml = processMarkdownToHtml(introMarkdownRaw);

      introBuffer = [];
    };

    const commitSection = () => {
      commitQuestion();
      commitIntro();
      if( currentSection ) sections.push(currentSection);
      currentSection = null;
      currentQuestion = null;
      answerBuffer = [];
      introBuffer = [];
    };

    for( const line of lines ) {
      if( line.startsWith('## ') ) {
        commitSection();
        const parsed = this._parseHeading(line.replace(/^##\s+/, ''), `section-${sections.length+1}`);
        currentSection = {
          id: parsed.id,
          title: parsed.title,
          items: [],
          introHtml: null
        };
        continue;
      }

      if( line.startsWith('### ') ) {
        if( !currentSection ) continue;

        commitIntro();
        commitQuestion();
        const parsed = this._parseHeading(line.replace(/^###\s+/, ''), `question-${currentSection.items.length+1}`);
        currentQuestion = {
          id: parsed.id,
          question: parsed.title
        };
        continue;
      }

      if( currentQuestion ) {
        answerBuffer.push(line);
      } else if( currentSection && !currentQuestion ) {
        introBuffer.push(line);
      }
    }

    commitSection();
    return sections;
  }

  _logFaqStructureWarnings(sections=[]) {
    if( !sections.length ) {
      console.warn('FAQ markdown parsed, but no sections were found. Expected headings starting with "## ".');
      return;
    }

    const emptySections = sections.filter(section => !section.items?.length).map(section => section.id || section.title);
    if( emptySections.length ) {
      console.warn('FAQ markdown includes section(s) with no questions. Expected question headings starting with "### " inside each section.', emptySections);
    }
  }

  async _fetchFaqMarkdown() {
    const useGcs = APP_CONFIG?.faqUseGcs === true;
    const markdownUrl = APP_CONFIG?.faqMarkdownUrl || 'https://storage.googleapis.com/aggie-experts-static-assets';

    if( !useGcs ) {
      const localMarkdownUrl = '/static-assets/faq/faq.md';

      try {
        const resp = await fetch(localMarkdownUrl);
        if( !resp.ok ) throw new Error(`Failed to fetch ${localMarkdownUrl}: ${resp.status}`);
        this.imgPath = '/static-assets/faq/images/';
        return await resp.text();
      } catch(e) {
        throw e;
      }
    }

    const fullUrl = markdownUrl.endsWith('/') ? markdownUrl + 'faq/faq.md' : markdownUrl + '/faq/faq.md';

    try {
      const resp = await fetch(fullUrl);
      if( !resp.ok ) throw new Error(`Failed to fetch ${fullUrl}: ${resp.status}`);
      const markdown = await resp.text();

      const baseUrl = markdownUrl.endsWith('/') ? markdownUrl.slice(0, -1) : markdownUrl;
      this.imgPath = baseUrl + '/faq/images/';
      
      return markdown;
    } catch(e) {
      throw e;
    }
  }

  async _loadFaqContent() {
    try {
      const markdown = await this._fetchFaqMarkdown();
      this.faqSections = this._parseFaqMarkdown(markdown);
      this._logFaqStructureWarnings(this.faqSections);
      this.faqLoadError = '';
    } catch(e) {
      this.faqSections = [];
      this.faqLoadError = e?.message || 'Unable to load FAQ content.';
      // Keep a clear signal in logs without breaking page rendering.
      console.error('FAQ load error', e);
    }

    this.faqLoaded = true;
  }

  _onFaqContentClick(e) {
    const anchor = e.composedPath().find(el => el?.tagName === 'A' && typeof el?.getAttribute === 'function');
    if( !anchor ) return;

    const href = anchor.getAttribute('href') || '';
    if( !href.startsWith('#') ) return;

    const jumpTo = href.replace('#', '').trim();
    if( !jumpTo ) return;

    e.preventDefault();
    this._jumpTo({
      preventDefault : () => {},
      currentTarget : {
        dataset : { jumpTo }
      }
    });
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'faq' ) return;

    // jumpTo section if hash in url path
    if( e.location.hash ) {
      requestAnimationFrame(() => this._jumpTo({currentTarget: {dataset: {jumpTo: e.location.hash}}}));
    }
  }

  async updated(changedProperties) {
    if (this.AppStateModel?.location?.page === 'faq' && this.AppStateModel?.location?.hash) {
      this._jumpTo({currentTarget: {dataset: {jumpTo: this.AppStateModel.location.hash}}});
    }
  }

  /**
   * @method _jumpTo
   * @description jump to faq item and open it if closed
   *
   * @param {Object} event
   */
  async _jumpTo(e) {
    if( e.preventDefault ) e.preventDefault();

    // wait for content and child components to render
    await this.updateComplete;
    let childComponents = this.shadowRoot.querySelectorAll('*');
    await Promise.all(Array.from(childComponents).map(async (child) => {
      if( child.updateComplete ) {
        await child.updateComplete;
      }
    }));

    let ignoreAccordions = false;
    let jumpToSection = this.shadowRoot.querySelector('h2#'+e.currentTarget.dataset.jumpTo);
    if( jumpToSection ) ignoreAccordions = true;
    else jumpToSection = this.shadowRoot.querySelector('ucd-theme-list-accordion li#'+e.currentTarget.dataset.jumpTo);

    if( !jumpToSection ) return;

    let posY = Math.floor(jumpToSection.getBoundingClientRect().top + window.pageYOffset - 10);
    window.scrollTo(0, posY);

    if( ignoreAccordions ) return;

    // open item
    let accordions = this.shadowRoot.querySelectorAll('ucd-theme-list-accordion');
    if( !accordions || !accordions.length ) return;

    let index = jumpToSection.slot.split('-').pop();
    accordions.forEach(accordion => {
      if( !accordion.itemIsExpanded(index, false) ) {
        accordion.toggleItemVisiblity(index, false, false);
      }
    });
  }

}

customElements.define('app-faq', AppFaq);
