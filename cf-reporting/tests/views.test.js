import assert from 'assert';
import { VIEWS } from '../lib/views/index.js';
import { buildStatusClassFilter } from '../lib/views/filters.js';
import { rewriteApiPath } from '../lib/views/human-page-views.js';

const filters = { sinceDate: '2026-01-01', untilDate: '2026-01-31' };

describe('lib/views/*.js', () => {
  it('every view exposes the required contract shape', () => {
    for (const [name, view] of Object.entries(VIEWS)) {
      assert.strictEqual(view.name, name);
      assert.strictEqual(typeof view.description, 'string');
      assert.strictEqual(typeof view.defaultFilename, 'string');
      assert.strictEqual(typeof view.buildQuery, 'function');
      assert.strictEqual(typeof view.toRows, 'function');
    }
  });

  describe('api-calls', () => {
    it('builds a date-range + path-prefix filter ordered by count desc', () => {
      const plan = VIEWS['api-calls'].buildQuery({ ...filters, apiPathPrefix: '/api/' });
      assert.strictEqual(plan.datasetField, 'httpRequestsAdaptiveGroups');
      assert.strictEqual(plan.filter.clientRequestPath_like, '/api/%');
      assert.deepStrictEqual(plan.orderBy, ['count_DESC']);
    });

    it('maps rows to {path, calls}', () => {
      const rows = VIEWS['api-calls'].toRows([{ count: 5, dimensions: { clientRequestPath: '/api/foo' } }]);
      assert.deepStrictEqual(rows, [{ path: '/api/foo', calls: 5 }]);
    });
  });

  describe('bot-page-views / human-page-views', () => {
    it('filters on botScore_lt for bots and botScore_geq for humans', () => {
      const botPlan = VIEWS['bot-page-views'].buildQuery({ ...filters, botScoreThreshold: 30 });
      const humanPlan = VIEWS['human-page-views'].buildQuery({ ...filters, botScoreThreshold: 30 });
      assert.strictEqual(botPlan.filter.botScore_lt, 30);
      assert.strictEqual(humanPlan.filter.botScore_geq, 30);
    });

    it('both require Bot Management', () => {
      assert.strictEqual(VIEWS['bot-page-views'].requiresBotManagement, true);
      assert.strictEqual(VIEWS['human-page-views'].requiresBotManagement, true);
    });
  });

  for (const viewName of ['human-page-views', 'bot-page-views']) {
    describe(`${viewName} path whitelist + rewrite`, () => {
      it('builds an OR filter of whitelisted direct paths and /api/* prefixes', () => {
        const plan = VIEWS[viewName].buildQuery(filters);
        const [inClause, ...likeClauses] = plan.filter.OR;
        assert.deepStrictEqual(inClause.clientRequestPath_in, [
          '/', '/browse', '/search', '/expert', '/work', '/grant', '/search-tips', '/faq',
          '/api/search', '/api/expert', '/api/work', '/api/grant'
        ]);
        assert.deepStrictEqual(
          likeClauses.map(clause => clause.clientRequestPath_like),
          ['/api/search/%', '/api/expert/%', '/api/work/%', '/api/grant/%']
        );
        assert.deepStrictEqual(plan.orderBy, ['count_DESC']);
      });

      it('toRows merges a direct hit and its matching /api/* hit into one row', () => {
        const rows = VIEWS[viewName].toRows([
          { count: 3, dimensions: { clientRequestPath: '/search' } },
          { count: 7, dimensions: { clientRequestPath: '/api/search' } },
          { count: 2, dimensions: { clientRequestPath: '/api/expert/111' } },
          { count: 5, dimensions: { clientRequestPath: '/api/expert/222' } }
        ]);
        assert.deepStrictEqual(rows, [
          { path: '/search', pageViews: 10 },
          { path: '/expert/222', pageViews: 5 },
          { path: '/expert/111', pageViews: 2 }
        ]);
      });
    });
  }

  describe('rewriteApiPath', () => {
    it('drops /api, keeping the rest as-is', () => {
      assert.strictEqual(rewriteApiPath('/api/expert/21453'), '/expert/21453');
      assert.strictEqual(rewriteApiPath('/api/search'), '/search');
    });

    it('moves a browse segment to the front', () => {
      assert.strictEqual(rewriteApiPath('/api/grant/browse'), '/browse/grant');
    });
  });

  describe('unique-bot-visitors / unique-human-visitors', () => {
    it('request pagination via cursorField', () => {
      const plan = VIEWS['unique-bot-visitors'].buildQuery(filters);
      assert.strictEqual(plan.cursorField, 'datetime');
    });

    it('counts distinct client IPs per day', () => {
      const rawRows = [
        { dimensions: { date: '2026-01-01', clientIP: '1.1.1.1', datetime: '2026-01-01T00:00:00Z' } },
        { dimensions: { date: '2026-01-01', clientIP: '1.1.1.1', datetime: '2026-01-01T00:00:01Z' } },
        { dimensions: { date: '2026-01-01', clientIP: '2.2.2.2', datetime: '2026-01-01T00:00:02Z' } },
        { dimensions: { date: '2026-01-02', clientIP: '3.3.3.3', datetime: '2026-01-02T00:00:00Z' } }
      ];
      const rows = VIEWS['unique-bot-visitors'].toRows(rawRows);
      assert.deepStrictEqual(rows, [
        { date: '2026-01-01', uniqueVisitors: 2 },
        { date: '2026-01-02', uniqueVisitors: 1 }
      ]);
    });
  });

  describe('top-pages', () => {
    it('defaults the limit to config.report.defaultTopPagesLimit', () => {
      const plan = VIEWS['top-pages'].buildQuery(filters);
      assert.strictEqual(plan.limit, 50);
      assert.deepStrictEqual(plan.orderBy, ['count_DESC']);
    });

    it('respects an explicit limit override', () => {
      const plan = VIEWS['top-pages'].buildQuery({ ...filters, limit: 10 });
      assert.strictEqual(plan.limit, 10);
    });

    it('maps rows to {path, views}', () => {
      const rows = VIEWS['top-pages'].toRows([{ count: 9, dimensions: { clientRequestPath: '/home' } }]);
      assert.deepStrictEqual(rows, [{ path: '/home', views: 9 }]);
    });
  });

  describe('global status class filter', () => {
    // country-breakdown is excluded: httpRequests1dGroups's filter type has no
    // edgeResponseStatus field, so that view can't be filtered by status class.
    const statusFilterableViews = Object.entries(VIEWS).filter(([name]) => name !== 'country-breakdown');

    it('every status-filterable view defaults to edgeResponseStatus in [200, 300) (config default 2xx)', () => {
      for (const [name, view] of statusFilterableViews) {
        const plan = view.buildQuery(filters);
        assert.strictEqual(plan.filter.edgeResponseStatus_geq, 200, `${name} should default to 2xx geq`);
        assert.strictEqual(plan.filter.edgeResponseStatus_lt, 300, `${name} should default to 2xx lt`);
      }
    });

    it('every status-filterable view respects a per-call statusClass override', () => {
      for (const [name, view] of statusFilterableViews) {
        const plan = view.buildQuery({ ...filters, statusClass: '4xx' });
        assert.strictEqual(plan.filter.edgeResponseStatus_geq, 400, `${name} should respect 4xx geq override`);
        assert.strictEqual(plan.filter.edgeResponseStatus_lt, 500, `${name} should respect 4xx lt override`);
      }
    });

    it('buildStatusClassFilter maps each class to its status range', () => {
      assert.deepStrictEqual(buildStatusClassFilter({ statusClass: '5xx' }), {
        edgeResponseStatus_geq: 500,
        edgeResponseStatus_lt: 600
      });
    });

    it('buildStatusClassFilter throws on an invalid class', () => {
      assert.throws(() => buildStatusClassFilter({ statusClass: '9xx' }), /Invalid statusClass/);
    });
  });

  describe('country-breakdown', () => {
    it('builds an inclusive date-only filter (date_geq/date_leq), not datetime_geq, and no status filter', () => {
      const plan = VIEWS['country-breakdown'].buildQuery(filters);
      assert.strictEqual(plan.datasetField, 'httpRequests1dGroups');
      assert.strictEqual(plan.filter.date_geq, filters.sinceDate);
      assert.strictEqual(plan.filter.date_leq, filters.untilDate);
      assert.ok(!('datetime_geq' in plan.filter));
      assert.ok(!('edgeResponseStatus_geq' in plan.filter));
    });

    it('sums countryMap entries across multiple rows', () => {
      const rawRows = [
        { sum: { countryMap: [{ clientCountryName: 'US', requests: 10, bytes: 100, threats: 1 }] } },
        { sum: { countryMap: [{ clientCountryName: 'US', requests: 5, bytes: 50, threats: 0 }, { clientCountryName: 'CA', requests: 2, bytes: 20, threats: 0 }] } }
      ];
      const rows = VIEWS['country-breakdown'].toRows(rawRows);
      assert.deepStrictEqual(rows, [
        { country: 'US', requests: 15, bytes: 150, threats: 1 },
        { country: 'CA', requests: 2, bytes: 20, threats: 0 }
      ]);
    });
  });
});
