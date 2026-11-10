import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import runQuery from '../lib/commands/query.js';

describe('lib/commands/query.js', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cf-reporting-query-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('builds the selection from --dimension/--sum and writes a flattened CSV', async () => {
    let capturedPlan;
    const fakeClient = {
      async runGroupsQuery(plan) {
        capturedPlan = plan;
        return [{ count: 3, dimensions: { clientCountryName: 'US' }, sum: { requests: 100 } }];
      },
      async runGroupsQueryAll(plan) {
        return this.runGroupsQuery(plan);
      }
    };

    const outputFile = path.join(tmpDir, 'out.csv');
    await runQuery({
      dataset: 'httpRequestsAdaptiveGroups',
      dimensions: ['clientCountryName'],
      sumFields: ['requests'],
      start: '2026-01-01',
      end: '2026-01-01',
      outputFile,
      client: fakeClient
    });

    assert.strictEqual(capturedPlan.datasetField, 'httpRequestsAdaptiveGroups');
    assert.strictEqual(capturedPlan.selection, 'count dimensions { clientCountryName } sum { requests }');

    const contents = await fs.promises.readFile(outputFile, 'utf8');
    assert.strictEqual(contents, 'clientCountryName,requests,count\nUS,100,3\n');
  });

  it('omits count when --no-count is passed', async () => {
    let capturedPlan;
    const fakeClient = {
      async runGroupsQuery(plan) {
        capturedPlan = plan;
        return [{ dimensions: { date: '2026-01-01' } }];
      },
      async runGroupsQueryAll(plan) {
        return this.runGroupsQuery(plan);
      }
    };

    const outputFile = path.join(tmpDir, 'out.csv');
    await runQuery({
      dataset: 'httpRequests1dGroups',
      dimensions: ['date'],
      count: false,
      start: '2026-01-01',
      end: '2026-01-01',
      outputFile,
      client: fakeClient
    });

    const contents = await fs.promises.readFile(outputFile, 'utf8');
    assert.strictEqual(contents, 'date\n2026-01-01\n');
    assert.strictEqual(capturedPlan.filter.date_geq, '2026-01-01');
    assert.strictEqual(capturedPlan.filter.date_leq, '2026-01-01');
    assert.ok(!('datetime_geq' in capturedPlan.filter));
  });

  it('merges --filter-json onto the date-range filter', async () => {
    let capturedPlan;
    const fakeClient = {
      async runGroupsQuery(plan) {
        capturedPlan = plan;
        return [];
      },
      async runGroupsQueryAll(plan) {
        return this.runGroupsQuery(plan);
      }
    };

    await runQuery({
      dataset: 'httpRequestsAdaptiveGroups',
      extraFilter: { botScore_lt: 10 },
      start: '2026-01-01',
      end: '2026-01-01',
      outputFile: path.join(tmpDir, 'out.csv'),
      client: fakeClient
    });

    assert.strictEqual(capturedPlan.filter.botScore_lt, 10);
    assert.ok('datetime_geq' in capturedPlan.filter);
  });
});
