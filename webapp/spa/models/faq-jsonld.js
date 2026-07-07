const fs = require('fs/promises');
const path = require('path');
const { logger } = require('@ucd-lib/experts-commons');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = Number(process.env.CLIENT_STATIC_ASSETS_JSONLD_TTL_MS || ONE_DAY_MS);
const LOG_CACHE_HITS = String(process.env.CLIENT_STATIC_ASSETS_JSONLD_LOG_CACHE_HITS || '').toLowerCase() === 'true';
const FAQ_MARKDOWN_URL = (process.env.CLIENT_STATIC_ASSETS_BASE_URL || 'https://storage.googleapis.com/aggie-experts-static-assets') + '/faq/faq.md';

const cache = {
  value: '',
  fetchedAt: 0,
  pendingRefresh: null
};

async function getFaqJsonLd() {
  const now = Date.now();
  const fresh = cache.value && (now - cache.fetchedAt) < CACHE_TTL_MS;
  if( fresh ) {
    if( LOG_CACHE_HITS ) {
      logger.info('FAQ JSON-LD cache hit', {
        ageMs: now - cache.fetchedAt,
        ttlMs: CACHE_TTL_MS
      });
    }
    return cache.value;
  }

  if( cache.pendingRefresh ) {
    if( LOG_CACHE_HITS ) logger.info('FAQ JSON-LD cache refresh already pending');
    return cache.pendingRefresh;
  }

  logger.info('Refreshing FAQ JSON-LD cache from markdown source');

  cache.pendingRefresh = (async () => {
    try {
      const { markdown, source } = await loadFaqMarkdown();
      const questions = parseFaqQuestions(markdown);
      if( !questions.length ) {
        if( cache.value ) return cache.value;
        throw new Error('No FAQ questions parsed from markdown');
      }

      cache.value = buildJsonLd(questions);
      cache.fetchedAt = Date.now();
      logger.info('FAQ JSON-LD cache refreshed', {
        source,
        questionCount: questions.length,
        ttlMs: CACHE_TTL_MS
      });
      return cache.value;
    } finally {
      cache.pendingRefresh = null;
    }
  })();

  try {
    return await cache.pendingRefresh;
  } catch (e) {
    if( cache.value ) {
      logger.warn('FAQ JSON-LD refresh failed; serving stale cached value', {
        error: e?.message || String(e)
      });
      return cache.value;
    }
    logger.error('FAQ JSON-LD refresh failed and no cache is available', {
      error: e?.message || String(e)
    });
    throw e;
  }
}

async function loadFaqMarkdown() {
  try {
    const resp = await fetch(FAQ_MARKDOWN_URL);
    if( resp.ok ) {
      return {
        markdown: await resp.text(),
        source: 'gcs'
      };
    }
    logger.warn('FAQ markdown fetch returned non-OK response; falling back to local file', {
      url: FAQ_MARKDOWN_URL,
      status: resp.status
    });
  } catch (e) {
    logger.warn('FAQ markdown fetch failed; falling back to local file', {
      url: FAQ_MARKDOWN_URL,
      error: e?.message || String(e)
    });
  }

  const localPath = path.join(__dirname, '..', 'client', 'static-assets', 'faq', 'faq.md');
  return {
    markdown: await fs.readFile(localPath, 'utf8'),
    source: 'local-file'
  };
}

function buildJsonLd(parsedQuestions=[]) {
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
    mainEntity: parsedQuestions.map(item => faqItem(item.question, item.answer))
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

function parseFaqQuestions(markdown='') {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output = [];

  let currentQuestion = null;
  let answerBuffer = [];

  const commitQuestion = () => {
    if( !currentQuestion ) return;
    const answer = markdownToPlainText(resolveAuthBlocks(answerBuffer.join('\n'), false));
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

function resolveAuthBlocks(markdown='', isLoggedIn=false) {
  return markdown.replace(/\{\{ifLoggedIn\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/ifLoggedIn\}\}/g, (m, loggedInContent, loggedOutContent='') => {
    return isLoggedIn ? loggedInContent : loggedOutContent;
  });
}

function markdownToPlainText(markdown='') {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function faqItem(question, answer) {
  return {
    '@type': 'Question',
    name: question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: answer
    }
  };
}

module.exports = getFaqJsonLd;