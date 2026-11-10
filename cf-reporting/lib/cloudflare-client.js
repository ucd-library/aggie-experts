import config from './config.js';
import logger from './logger.js';

/**
 * @description Serializes a plain JS value into Cloudflare GraphQL input-object
 * literal syntax (unquoted keys, quoted strings, bare numbers/booleans, bracketed
 * arrays). Used to inline filter objects directly into a query string instead of
 * relying on dataset-specific generated variable types.
 * @param {*} value
 * @returns {string}
 */
function toGraphQLLiteral(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toGraphQLLiteral).join(', ')}]`;
  if (typeof value === 'object') {
    const fields = Object.entries(value).map(([key, val]) => `${key}: ${toGraphQLLiteral(val)}`);
    return `{ ${fields.join(', ')} }`;
  }
  throw new Error(`Cannot serialize value of type ${typeof value} to a GraphQL literal`);
}

/**
 * @description Thin client over Cloudflare's GraphQL Analytics API
 * (https://api.cloudflare.com/client/v4/graphql), scoped to a single zone.
 */
export class CloudflareClient {
  /**
   * @param {Object} [opts={}]
   * @param {string} [opts.apiToken] - Defaults to config.cloudflare.apiToken.
   * @param {string} [opts.zoneId] - Defaults to config.cloudflare.zoneId.
   * @param {string} [opts.apiBaseUrl] - Defaults to config.cloudflare.apiBaseUrl.
   * @param {number} [opts.timeoutMs] - Defaults to config.cloudflare.requestTimeoutMs.
   */
  constructor(opts = {}) {
    this.apiToken = opts.apiToken || config.cloudflare.apiToken;
    this.zoneId = opts.zoneId || config.cloudflare.zoneId;
    this.apiBaseUrl = opts.apiBaseUrl || config.cloudflare.apiBaseUrl;
    this.timeoutMs = opts.timeoutMs || config.cloudflare.requestTimeoutMs;
  }

  /**
   * @returns {Object} Authorization/content-type headers for every request.
   */
  _authHeaders() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * @description Low-level POST to the GraphQL endpoint. Throws a detailed
   * Error on transport failure, HTTP failure, or any `errors[]` entry in a
   * 200 response (Cloudflare returns GraphQL errors inline in the body).
   * @param {Object} opts
   * @param {string} opts.query - GraphQL query string.
   * @returns {Promise<Object>} The `data` object from the GraphQL response.
   */
  async _fetch({ query }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let res;
    try {
      res = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify({ query }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    let body;
    try {
      body = await res.json();
    } catch (e) {
      console.log('Failed to parse JSON response from Cloudflare GraphQL API:', e);
      body = {};
    }

    if (!res.ok) {
      const err = new Error(`POST ${this.apiBaseUrl}\nHTTP ${res.status}: ${res.statusText}\n${JSON.stringify(body)}`);
      err.status = res.status;
      throw err;
    }
    if (body.errors && body.errors.length) {
      const err = new Error(`Cloudflare GraphQL error: ${body.errors.map(e => e.message).join('; ')}`);
      err.errors = body.errors;
      throw err;
    }

    return body.data;
  }

  /**
   * @description Runs one GraphQL query against this zone's analytics datasets
   * and returns the raw array of group rows for the named dataset field.
   * @param {Object} opts
   * @param {string} opts.datasetField - e.g. 'httpRequestsAdaptiveGroups'.
   * @param {string} opts.selection - Raw GraphQL selection-set body for the dataset field (count/sum/uniq/dimensions blocks).
   * @param {Object} opts.filter - Filter clause object, inlined as a GraphQL literal.
   * @param {number} [opts.limit=5000]
   * @param {string[]} [opts.orderBy]
   * @returns {Promise<Array<Object>>} Rows as returned by Cloudflare.
   */
  async runGroupsQuery({ datasetField, selection, filter, limit = 5000, orderBy } = {}) {
    const args = [`filter: ${toGraphQLLiteral(filter || {})}`, `limit: ${limit}`];
    if (orderBy && orderBy.length) {
      args.push(`orderBy: [${orderBy.join(', ')}]`);
    }

    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: ${toGraphQLLiteral(this.zoneId)} }) {
            ${datasetField}(${args.join(', ')}) {
              ${selection}
            }
          }
        }
      }
    `;

    const data = await this._fetch({ query });
    const zone = data?.viewer?.zones?.[0];
    return (zone && zone[datasetField]) || [];
  }

  /**
   * @description Repeatedly calls runGroupsQuery, cursoring forward on
   * `<cursorField>_gt` using the last row's cursor-field dimension value,
   * until a page comes back with fewer than `limit` rows. The selection must
   * include `cursorField` under `dimensions` for this to work.
   * @param {Object} opts - Same as runGroupsQuery, plus:
   * @param {string} opts.cursorField - Dimension field to cursor on (e.g. 'datetime').
   * @returns {Promise<Array<Object>>} All rows across every page, concatenated.
   */
  async runGroupsQueryAll({ datasetField, selection, filter, limit = 5000, orderBy, cursorField } = {}) {
    const allRows = [];
    let currentFilter = filter;

    for (;;) {
      const page = await this.runGroupsQuery({ datasetField, selection, filter: currentFilter, limit, orderBy });
      allRows.push(...page);
      if (page.length < limit) break;

      const lastValue = page[page.length - 1]?.dimensions?.[cursorField];
      if (!lastValue) break;
      currentFilter = { ...currentFilter, [`${cursorField}_gt`]: lastValue };
    }

    return allRows;
  }

  /**
   * @description Probes whether Bot Management data appears available for this
   * zone/token, by issuing a small httpRequestsAdaptiveGroups query grouped by
   * the botScore dimension over the given date range and checking whether any
   * non-null score comes back (botScore isn't avg-able in Cloudflare's schema,
   * only usable as a dimension or filter). A zone with zero requests in the
   * probed range always looks unavailable, so pass the same range the caller
   * is about to report on rather than relying on the last-24h fallback.
   * @param {Object} [opts={}]
   * @param {string} [opts.sinceDate] - YYYY-MM-DD, inclusive. Defaults to 24h ago when omitted.
   * @param {string} [opts.untilDate] - YYYY-MM-DD, inclusive. Defaults to now when omitted.
   * @returns {Promise<boolean>}
   */
  async checkBotManagementAvailable({ sinceDate, untilDate } = {}) {
    try {
      let since, untilExclusive;
      if (sinceDate && untilDate) {
        since = new Date(`${sinceDate}T00:00:00Z`);
        untilExclusive = new Date(`${untilDate}T00:00:00Z`);
        untilExclusive.setUTCDate(untilExclusive.getUTCDate() + 1);
      } else {
        untilExclusive = new Date();
        since = new Date(untilExclusive.getTime() - 24 * 60 * 60 * 1000);
      }

      const rows = await this.runGroupsQuery({
        datasetField: 'httpRequestsAdaptiveGroups',
        selection: 'count dimensions { botScore }',
        filter: { datetime_geq: since.toISOString(), datetime_lt: untilExclusive.toISOString() },
        limit: 1
      });

      logger.debug('checkBotManagementAvailable probe rows:', JSON.stringify(rows));
      return rows.some(row => row?.dimensions?.botScore !== null && row?.dimensions?.botScore !== undefined);
    } catch (err) {
      logger.debug('checkBotManagementAvailable probe failed:', err.message);
      return false;
    }
  }
}

export default CloudflareClient;
