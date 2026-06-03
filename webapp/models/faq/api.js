const router = require('express').Router();
const path = require('path');
const fs = require('fs/promises');
const { logger } = require('@ucd-lib/experts-commons');

const CACHE_TTL_MS = Number(process.env.CONTENT_CACHE_TTL_MS || 5 * 60 * 1000);
const CASK_FAQ_PATH = '/application/webapp/docs/faq.md';
const CASK_IMAGES_ROOT = '/application/webapp/docs/images';
const CASK_REQUESTOR = 'aggie-experts-webapp';

// In-memory TTL cache for the markdown content
const faqCache = { value: null, fetchedAt: 0, pendingRefresh: null };

// Lazily initialised CaskFS instance — created once on first request
let _caskFs = null;

/**
 * @function getCaskFs
 * @description Lazily instantiate and initialise a CaskFS client using the
 * webapp's own postgres config. Uses dynamic import to load the ESM caskfs
 * module from the mounted source path.
 *
 * @returns {Promise<Object>} initialised CaskFS instance
 */
async function getCaskFs() {
  if( _caskFs ) return _caskFs;
  const { default: CaskFS } = await import('/opt/caskfs/src/index.js');
  _caskFs = new CaskFS();
  await _caskFs.dbClient.init();
  return _caskFs;
}

/**
 * @function fetchFaqFromCaskfs
 * @description Read faq.md from caskfs. Falls back to the bundled static
 * asset if caskfs is unavailable.
 *
 * @returns {Promise<string>} raw markdown content
 */
async function fetchFaqFromCaskfs() {
  try {
    const caskFs = await getCaskFs();
    return await caskFs.read(
      { filePath: CASK_FAQ_PATH, requestor: CASK_REQUESTOR },
      { encoding: 'utf8' }
    );
  } catch(e) {
      

    // logger.warn('caskfs faq.md read failed; falling back to local file', { error: e?.message || String(e) });
  }
  throw e; // don't fall back on webapp content, need to fall back on the last cached version of the files
  
  // __dirname is /opt/webapp/models/faq in the container
  // const localPath = path.join(__dirname, '..', '..', 'spa', 'client', 'static-assets', 'faq', 'faq.md');
  // return fs.readFile(localPath, 'utf8');
}

/**
 * @function getCachedFaq
 * @description Return faq.md content with a TTL-based in-memory cache.
 * A pendingRefresh promise prevents concurrent refreshes.
 *
 * @returns {Promise<string>} raw markdown content
 */
async function getCachedFaq() {
  const now = Date.now();
  if( faqCache.value && (now - faqCache.fetchedAt) < CACHE_TTL_MS ) return faqCache.value;
  if( faqCache.pendingRefresh ) return faqCache.pendingRefresh;

  faqCache.pendingRefresh = (async () => {
    try {
      faqCache.value = await fetchFaqFromCaskfs();
      faqCache.fetchedAt = Date.now();
      logger.info('faq.md cache refreshed');
      return faqCache.value;
    } finally {
      faqCache.pendingRefresh = null;
    }
  })();

  try {
    return await faqCache.pendingRefresh;
  } catch(e) {
    if( faqCache.value ) {
      logger.warn('faq.md refresh failed; serving stale cache', { error: e?.message || String(e) });
      return faqCache.value;
    }
    throw e;
  }
}

/**
 * GET /
 * Returns the raw faq.md markdown content sourced from caskfs,
 * with a short TTL in-memory cache.
 */
router.get('/', async (req, res, next) => {
  try {
    const markdown = await getCachedFaq();
    res.type('text/plain').send(markdown);
  } catch(e) {
    logger.error('Failed to load faq.md', { error: e?.message || String(e) });
    res.status(503).json({ error: 'FAQ content unavailable' });
  }
});

/**
 * GET /images/:filename
 * Serve an image from caskfs, falling back to the static-assets path if unavailable.
 */
router.get('/images/:filename', async (req, res, next) => {
  const { filename } = req.params;
  const caskPath = `${CASK_IMAGES_ROOT}/${filename}`;

  try {
    const caskFs = await getCaskFs();
    // omitting encoding returns a raw Buffer suitable for binary files
    const buf = await caskFs.read(
      { filePath: caskPath, requestor: CASK_REQUESTOR }
    );
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.set('Content-Type', contentType).send(buf);
  } catch(e) {
    throw e; // don't fall back on webapp content, need to fall back on the last cached version of the files

    // logger.warn('caskfs image read failed; redirecting to static fallback', { filename, error: e?.message || String(e) });
    // res.redirect(`/static-assets/faq/images/${filename}`);
  }
});

module.exports = router;
