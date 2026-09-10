const { logger } = require('@ucd-lib/experts-commons');
const pool = require('./db.js');

// req.path is relative to the mount point this middleware is registered at
// (see index.js: app.use('/api', requestLog())), so segments[0] here is
// already the sub-API name (expert, search, miv, ...), not 'api' itself.
function parseApiPath(reqPath) {
  const segments = reqPath.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  return {
    root : segments[0],
    rest : segments.length > 1 ? '/' + segments.slice(1).join('/') : null
  };
}

module.exports = function requestLog() {
  return (req, res, next) => {
    const parsed = parseApiPath(req.path);
    if (parsed) {
      const ip = req.get('x-forwarded-for') || req.ip;
      const start = Date.now();

      // Wait for the proxied response so we can record status/latency; 
      // this never blocks or fails the request itself — the insert is
      // fire-and-forget after the response has already gone out.
      res.on('finish', () => {
        pool.query(
          `INSERT INTO api_reporting.request_log (path_root, path_rest, ip_address, status_code, latency_ms)
           VALUES ($1, $2, $3, $4, $5)`,
          [parsed.root, parsed.rest, ip, res.statusCode, Date.now() - start]
        ).catch(err => {
          logger.error('Failed to record API request log', err.message);
        });
      });
    }
    next();
  };
};
