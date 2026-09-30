/**
 * Pluggable email client for the grant-feed ingest trigger.
 *
 * The weekly Aggie Enterprise extract arrives as an email from
 * config.grantFeed.email.sender with an attachment named
 * config.grantFeed.email.attachmentName (AEgrants.xml). The receiving mailbox
 * has NOT been provisioned yet and the provider (IMAP / Microsoft Graph /
 * Gmail) is undecided, so this module ships a working STUB and a clear
 * interface to drop the real backend into later.
 *
 * A client must implement:
 *
 *   async connect()                 open the connection (no-op for stub)
 *   async fetchLatestInput()        -> InputResult (see below)
 *   async markProcessed(messageId)  mark the message handled (e.g. set \Seen)
 *   async close()                   tear down
 *
 * InputResult:
 *   { found: false, reason?: string }
 *   { found: true,
 *     filename: string,     // should equal cfg.attachmentName
 *     content: string,      // the XML, utf8
 *     messageId: string,
 *     receivedAt: string }  // ISO timestamp
 *
 * When implementing a real backend, the query is:
 *   unread messages from `cfg.sender` with an attachment named
 *   `cfg.attachmentName`, newest first; return the newest, download its
 *   attachment as utf8, and expose markProcessed() to avoid reprocessing.
 *
 * NEWNESS / IDEMPOTENCY — important contract detail:
 *   The check-email CLI has a coarse, week-level guard: it skips fetching if the
 *   input is already staged in CasKFS for the current year-week
 *   (/weekly/<year-week>/grant-feed/ae-grants.xml), unless --force is passed. So
 *   the CLI's notion of "new" is only "this week has no file yet."
 *
 *   That guard alone is NOT sufficient to decide message-level newness. If a
 *   CORRECTED extract is re-sent in the SAME week, the week-level guard would
 *   suppress it (the week already has a file). Therefore a real backend MUST
 *   drive newness off the message's own state — the unread/\Seen flag (or a
 *   persisted last-processed messageId / UID high-water mark) — and mark each
 *   handled message via markProcessed() so it is not returned again. Do not
 *   rely on the CasKFS weekly existence check as the dedupe mechanism.
 *
 *   Note the consequence: to let a same-week re-send actually reprocess, the
 *   CLI must be invoked with --force (or the guard revisited). If same-week
 *   "one file wins" is the desired behavior, the guard is fine as-is; if
 *   re-sends should win, prefer the message-state approach above and relax the
 *   CLI guard accordingly.
 */
import { logger, config } from '@ucd-lib/experts-commons';

class StubEmailClient {
  constructor(cfg) { this.cfg = cfg; }
  async connect() { /* no-op */ }
  async fetchLatestInput() {
    logger.warn(
      'grant-feed email backend is the STUB — no mailbox is configured. ' +
      'Set config.grantFeed.email.backend + .enabled (and provision the ' +
      'receiving address) to enable automated ingest.'
    );
    return { found: false, reason: 'stub-backend' };
  }
  async markProcessed() { /* no-op */ }
  async close() { /* no-op */ }
}

class NotImplementedEmailClient {
  constructor(backend) { this.backend = backend; }
  async connect() {
    throw new Error(
      `grant-feed email backend '${this.backend}' is selected but not implemented yet. ` +
      `Implement this client (see harvest/lib/grant-feed/email.js) or use backend 'stub'.`
    );
  }
  async fetchLatestInput() { return this.connect(); }
  async markProcessed() { return this.connect(); }
  async close() { /* no-op */ }
}

/**
 * Resolve an email client for the configured backend. Defaults to the stub.
 */
export function getEmailClient(cfg = config.grantFeed.email) {
  switch (cfg.backend) {
    case 'stub':
      return new StubEmailClient(cfg);
    case 'imap':
    case 'graph':
    case 'gmail':
      // Concrete backends are deferred until the mailbox/provider is chosen.
      return new NotImplementedEmailClient(cfg.backend);
    default:
      logger.warn(`Unknown grant-feed email backend '${cfg.backend}', falling back to stub.`);
      return new StubEmailClient(cfg);
  }
}

export default { getEmailClient };
