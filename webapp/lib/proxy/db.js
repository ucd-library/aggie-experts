const { Pool } = require('pg');
const { config, logger } = require('@ucd-lib/experts-commons');

// Small pooled connection, reused across requests, for gateway-side writes
// (currently just request-log.js). Not a general-purpose app pool — kept
// local to the gateway process, which is the only thing that needs it today.
const pool = new Pool({
  host : config.postgres.host,
  port : config.postgres.port,
  user : config.postgres.user,
  password : config.postgres.password,
  database : config.postgres.database
});

pool.on('error', (err) => {
  // emitted by an idle client in the pool; the pool discards it automatically
  logger.error('Postgres pool error', err.message);
});

module.exports = pool;
