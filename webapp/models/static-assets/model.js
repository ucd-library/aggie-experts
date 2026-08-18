const fs = require('fs/promises');
const path = require('path');
const { config, logger } = require('@ucd-lib/experts-commons');

const FAQ_LOCAL_FALLBACK_PATH = path.join(__dirname, '..', '..', 'spa', 'client', 'static-assets', 'faq', 'faq.md');

/**
 * @class StaticAssetsModel
 * @description Static web content (currently: the FAQ markdown + its SEO JSON-LD) backed by
 * CaskFS when config.caskfs.faqUseCaskfs is enabled, otherwise by the bundled local file.
 * Not ES-backed - does not extend BaseModel, since it has nothing to do with
 * Elasticsearch (see webapp/models/harvest for another non-ES model).
 */
class StaticAssetsModel {

  constructor() {
    this.caskfsBaseUrl = `${config.caskfs.host}${config.caskfs.pathPrefix}${config.caskfs.apiPath}/fs`;
    this._faqMarkdownCache = {
      value: undefined,
      fetchedAt: 0,
      pendingRefresh: null
    };
    this._seoCache = {
      value: undefined,
      builtFromFetchedAt: undefined
    };
  }

  /**
   * @method getFaqMarkdown
   * @description Get the current FAQ markdown. When config.caskfs.faqUseCaskfs is
   * false, always reads the bundled local file. When true, reads from CaskFS
   * (cached for up to config.caskfs.faqCacheTtlMs), falling back to the bundled
   * local file if CaskFS is unreachable.
   * @returns {Promise<String>}
   */
  async getFaqMarkdown() {
    const cache = this._faqMarkdownCache;
    const now = Date.now();
    const fresh = cache.value !== undefined && (now - cache.fetchedAt) < config.caskfs.faqCacheTtlMs;
    if( fresh ) return cache.value;

    if( cache.pendingRefresh ) return cache.pendingRefresh;

    cache.pendingRefresh = (async () => {
      try {
        const value = await this._fetchFaqMarkdown();
        cache.value = value;
        cache.fetchedAt = Date.now();
        return cache.value;
      } finally {
        cache.pendingRefresh = null;
      }
    })();

    try {
      return await cache.pendingRefresh;
    } catch(e) {
      if( cache.value !== undefined ) {
        logger.warn('FAQ markdown refresh failed; serving stale cached value', {
          error: e?.message || String(e)
        });
        return cache.value;
      }
      logger.error('FAQ markdown refresh failed and no cached value is available', {
        error: e?.message || String(e)
      });
      throw e;
    }
  }

  /**
   * @method refreshFaqMarkdown
   * @description Clear the cached FAQ markdown and immediately re-fetch it,
   * bypassing config.caskfs.faqCacheTtlMs.
   * @returns {Promise<String>}
   */
  refreshFaqMarkdown() {
    this._faqMarkdownCache = {
      value: undefined,
      fetchedAt: 0,
      pendingRefresh: null
    };
    return this.getFaqMarkdown();
  }

  /**
   * @method _fetchFaqMarkdown
   * @description Read the FAQ markdown from CaskFS, or the bundled local file
   * when config.caskfs.faqUseCaskfs is disabled or CaskFS is unreachable.
   * @returns {Promise<String>}
   */
  async _fetchFaqMarkdown() {
    if( !config.caskfs.faqUseCaskfs ) {
      return fs.readFile(FAQ_LOCAL_FALLBACK_PATH, 'utf8');
    }

    try {
      const resp = await fetch(`${this.caskfsBaseUrl}${config.caskfs.faqPath}`);
      if( !resp.ok ) {
        throw new Error(`CaskFS read failed for ${config.caskfs.faqPath}: ${resp.status} ${resp.statusText}`);
      }
      return await resp.text();
    } catch(e) {
      logger.warn('FAQ markdown fetch from CaskFS failed; falling back to bundled local file', {
        path: config.caskfs.faqPath,
        error: e?.message || String(e)
      });
      return fs.readFile(FAQ_LOCAL_FALLBACK_PATH, 'utf8');
    }
  }

  /**
   * @method seo
   * @description Build the FAQ JSON-LD for SEO, from the current FAQ markdown. The
   * built JSON-LD is cached alongside the markdown cache and only rebuilt when the
   * markdown has actually changed (tracked via _faqMarkdownCache.fetchedAt) - if
   * parsing yields no questions, the last-known-good JSON-LD is served instead of
   * failing outright. Matches the .seo() convention used by the expert/work/grant models.
   * @returns {Promise<String>}
   */
  async seo() {
    const markdown = await this.getFaqMarkdown();
    const markdownFetchedAt = this._faqMarkdownCache.fetchedAt;

    if( this._seoCache.value !== undefined && this._seoCache.builtFromFetchedAt === markdownFetchedAt ) {
      return this._seoCache.value;
    }

    const questions = this._parseFaqQuestions(markdown);
    if( !questions.length ) {
      if( this._seoCache.value !== undefined ) {
        logger.warn('FAQ markdown parsed to zero questions; serving last-known-good JSON-LD');
        return this._seoCache.value;
      }
      throw new Error('No FAQ questions parsed from markdown');
    }

    this._seoCache = {
      value: this._buildJsonLd(questions),
      builtFromFetchedAt: markdownFetchedAt
    };
    return this._seoCache.value;
  }

  _buildJsonLd(parsedQuestions=[]) {
    const faqPageId = 'https://experts.ucdavis.edu/faq#faqpage';
    const webPageId = 'https://experts.ucdavis.edu/faq#webpage';
    const webSiteId = 'https://experts.ucdavis.edu/#website';
    const publisherId = 'https://www.ucdavis.edu/#organization';

    const faqPage = {
      '@id': faqPageId,
      '@type': 'FAQPage',
      url: 'https://experts.ucdavis.edu/faq',
      name: 'Aggie Experts FAQ',
      inLanguage: 'en-US',
      publisher: {
        '@id': publisherId
      },
      mainEntityOfPage: {
        '@id': webPageId
      },
      isPartOf: {
        '@id': webSiteId
      },
      mainEntity: parsedQuestions.map(item => this._faqItem(item.question, item.answer))
    };

    const webPage = {
      '@id': webPageId,
      '@type': 'WebPage',
      url: 'https://experts.ucdavis.edu/faq',
      name: 'Aggie Experts Help',
      inLanguage: 'en-US',
      isPartOf: {
        '@id': webSiteId
      },
      mainEntity: {
        '@id': faqPageId
      }
    };

    const webSite = {
      '@id': webSiteId,
      '@type': 'WebSite',
      name: 'Aggie Experts',
      url: 'https://experts.ucdavis.edu',
      publisher: {
        '@id': publisherId
      }
    };

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        faqPage,
        webPage,
        webSite
      ]
    };

    return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  }

  _parseFaqQuestions(markdown='') {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const output = [];

    let currentQuestion = null;
    let answerBuffer = [];

    const commitQuestion = () => {
      if( !currentQuestion ) return;
      const answer = this._markdownToPlainText(this._resolveAuthBlocks(answerBuffer.join('\n'), false));
      if( answer ) output.push({ question: currentQuestion, answer });
      currentQuestion = null;
      answerBuffer = [];
    };

    for( const line of lines ) {
      if( line.startsWith('### ') ) {
        commitQuestion();
        const rawHeading = line.replace(/^###\s+/, '').trim();
        currentQuestion = rawHeading.replace(/\s*\{#[^}]+\}\s*$/, '').trim();
        continue;
      }

      if( line.startsWith('## ') ) {
        commitQuestion();
        continue;
      }

      if( currentQuestion ) answerBuffer.push(line);
    }

    commitQuestion();
    return output;
  }

  _resolveAuthBlocks(markdown='', isLoggedIn=false) {
    return markdown.replace(/\{\{ifLoggedIn\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/ifLoggedIn\}\}/g, (m, loggedInContent, loggedOutContent='') => {
      return isLoggedIn ? loggedInContent : loggedOutContent;
    });
  }

  _markdownToPlainText(markdown='') {
    return markdown
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/[`*_>#-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _faqItem(question, answer) {
    return {
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer
      }
    };
  }

}

module.exports = new StaticAssetsModel();
