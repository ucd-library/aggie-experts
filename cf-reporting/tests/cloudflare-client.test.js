import assert from 'assert';
import CloudflareClient from '../lib/cloudflare-client.js';

/**
 * @description Builds a fake fetch Response for a successful GraphQL call
 * returning the given rows under viewer.zones[0].<datasetField>.
 * @param {string} datasetField
 * @param {Array<Object>} rows
 * @returns {Response}
 */
function fakeResponse(datasetField, rows) {
  const body = { data: { viewer: { zones: [{ [datasetField]: rows }] } } };
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('lib/cloudflare-client.js', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends the Authorization header and a JSON query body', async () => {
    let capturedUrl, capturedOpts;
    globalThis.fetch = async (url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return fakeResponse('httpRequestsAdaptiveGroups', []);
    };

    const client = new CloudflareClient({ apiToken: 'tok123', zoneId: 'zone1', apiBaseUrl: 'https://example.com/graphql' });
    await client.runGroupsQuery({ datasetField: 'httpRequestsAdaptiveGroups', selection: 'count', filter: {}, limit: 10 });

    assert.strictEqual(capturedUrl, 'https://example.com/graphql');
    assert.strictEqual(capturedOpts.headers.Authorization, 'Bearer tok123');
    const sentBody = JSON.parse(capturedOpts.body);
    assert.ok(sentBody.query.includes('httpRequestsAdaptiveGroups'));
    assert.ok(sentBody.query.includes('zone1'));
  });

  it('throws when the GraphQL response contains errors[]', async () => {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ errors: [{ message: 'bad token' }] }),
      { status: 200 }
    );

    const client = new CloudflareClient({ apiToken: 'bad', zoneId: 'zone1' });
    await assert.rejects(
      () => client.runGroupsQuery({ datasetField: 'httpRequestsAdaptiveGroups', selection: 'count', filter: {} }),
      /bad token/
    );
  });

  it('throws on a non-2xx HTTP response', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 500, statusText: 'Internal Server Error' });

    const client = new CloudflareClient({ apiToken: 'tok', zoneId: 'zone1' });
    await assert.rejects(
      () => client.runGroupsQuery({ datasetField: 'httpRequestsAdaptiveGroups', selection: 'count', filter: {} }),
      /HTTP 500/
    );
  });

  it('paginates with runGroupsQueryAll until a short page is returned', async () => {
    const page1 = [
      { count: 1, dimensions: { datetime: '2026-01-01T00:00:00Z' } },
      { count: 1, dimensions: { datetime: '2026-01-01T00:00:01Z' } }
    ];
    const page2 = [
      { count: 1, dimensions: { datetime: '2026-01-01T00:00:02Z' } }
    ];
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      return fakeResponse('httpRequestsAdaptiveGroups', callCount === 1 ? page1 : page2);
    };

    const client = new CloudflareClient({ apiToken: 'tok', zoneId: 'zone1' });
    const rows = await client.runGroupsQueryAll({
      datasetField: 'httpRequestsAdaptiveGroups',
      selection: 'count dimensions { datetime }',
      filter: {},
      limit: 2,
      cursorField: 'datetime'
    });

    assert.strictEqual(rows.length, 3);
    assert.strictEqual(callCount, 2);
  });

  it('checkBotManagementAvailable returns true when a non-null botScore comes back', async () => {
    globalThis.fetch = async () => fakeResponse('httpRequestsAdaptiveGroups', [{ dimensions: { botScore: 42 } }]);
    const client = new CloudflareClient({ apiToken: 'tok', zoneId: 'zone1' });
    assert.strictEqual(await client.checkBotManagementAvailable(), true);
  });

  it('checkBotManagementAvailable returns false when no rows come back', async () => {
    globalThis.fetch = async () => fakeResponse('httpRequestsAdaptiveGroups', []);
    const client = new CloudflareClient({ apiToken: 'tok', zoneId: 'zone1' });
    assert.strictEqual(await client.checkBotManagementAvailable(), false);
  });

  it('checkBotManagementAvailable returns false when the request throws', async () => {
    globalThis.fetch = async () => { throw new Error('network down'); };
    const client = new CloudflareClient({ apiToken: 'tok', zoneId: 'zone1' });
    assert.strictEqual(await client.checkBotManagementAvailable(), false);
  });

  it('checkBotManagementAvailable probes the given date range instead of the last-24h default', async () => {
    let capturedQuery;
    globalThis.fetch = async (url, opts) => {
      capturedQuery = JSON.parse(opts.body).query;
      return fakeResponse('httpRequestsAdaptiveGroups', [{ dimensions: { botScore: 42 } }]);
    };

    const client = new CloudflareClient({ apiToken: 'tok', zoneId: 'zone1' });
    const available = await client.checkBotManagementAvailable({ sinceDate: '2026-01-01', untilDate: '2026-01-31' });

    assert.strictEqual(available, true);
    assert.ok(capturedQuery.includes('2026-01-01T00:00:00.000Z'));
    assert.ok(capturedQuery.includes('2026-02-01T00:00:00.000Z'));
  });
});
