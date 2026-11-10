import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import runExport from '../lib/commands/export.js';

/**
 * @description A stubbed CloudflareClient that returns one fixed row per
 * dataset field and never makes a real network call.
 * @param {Object} [opts={}]
 * @param {boolean} [opts.botManagementAvailable=true]
 * @returns {Object}
 */
function makeFakeClient({ botManagementAvailable = true } = {}) {
  return {
    async checkBotManagementAvailable() {
      return botManagementAvailable;
    },
    async runGroupsQuery({ datasetField }) {
      if (datasetField === 'httpRequests1dGroups') {
        return [{ sum: { countryMap: [{ clientCountryName: 'US', requests: 1, bytes: 1, threats: 0 }] } }];
      }
      return [{ count: 1, dimensions: { date: '2026-01-01', clientRequestPath: '/home', clientIP: '1.1.1.1', datetime: '2026-01-01T00:00:00Z' } }];
    },
    async runGroupsQueryAll(opts) {
      return this.runGroupsQuery(opts);
    }
  };
}

describe('lib/commands/export.js', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cf-reporting-export-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes one CSV per included view into a named, dated folder', async () => {
    const { folderPath } = await runExport({
      start: '2026-01-01',
      end: '2026-01-01',
      outputDir: tmpDir,
      appName: 'my-app',
      client: makeFakeClient()
    });

    assert.strictEqual(path.basename(folderPath), 'my-app-2026-01-01-2026-01-01');
    const files = await fs.promises.readdir(folderPath);
    assert.strictEqual(files.length, 7);
    assert.ok(files.includes('top-pages.csv'));
    assert.ok(files.includes('country-breakdown.csv'));
  });

  it('respects --views to include only specific views', async () => {
    const { folderPath } = await runExport({
      start: '2026-01-01',
      end: '2026-01-01',
      outputDir: tmpDir,
      appName: 'my-app',
      includeViews: ['top-pages', 'country-breakdown'],
      client: makeFakeClient()
    });

    const files = await fs.promises.readdir(folderPath);
    assert.deepStrictEqual(files.sort(), ['country-breakdown.csv', 'top-pages.csv']);
  });

  it('respects --exclude-views applied after --views', async () => {
    const { folderPath } = await runExport({
      start: '2026-01-01',
      end: '2026-01-01',
      outputDir: tmpDir,
      appName: 'my-app',
      excludeViews: ['bot-page-views', 'human-page-views', 'unique-bot-visitors', 'unique-human-visitors'],
      client: makeFakeClient()
    });

    const files = await fs.promises.readdir(folderPath);
    assert.deepStrictEqual(files.sort(), ['api-calls.csv', 'country-breakdown.csv', 'top-pages.csv']);
  });

  it('zips the output folder and deletes the unzipped copy when --zip is set', async () => {
    const { folderPath, zipPath } = await runExport({
      start: '2026-01-01',
      end: '2026-01-01',
      outputDir: tmpDir,
      appName: 'my-app',
      includeViews: ['top-pages'],
      zip: true,
      client: makeFakeClient()
    });

    assert.strictEqual(folderPath, null);
    assert.ok(zipPath.endsWith('my-app-2026-01-01-2026-01-01.zip'));
    const zipStat = await fs.promises.stat(zipPath);
    assert.ok(zipStat.size > 0);
    await assert.rejects(() => fs.promises.stat(zipPath.replace(/\.zip$/, '')));
  });

  it('uploads the zip to GCS when --zip and a gcsBucket are set', async () => {
    const uploadCalls = [];
    const storage = {
      bucket(bucketName) {
        return {
          async upload(localPath, options) {
            uploadCalls.push({ bucketName, localPath, options });
          }
        };
      }
    };

    const { zipPath, gcsPath } = await runExport({
      start: '2026-01-01',
      end: '2026-01-01',
      outputDir: tmpDir,
      appName: 'my-app',
      includeViews: ['top-pages'],
      zip: true,
      gcsBucket: 'cf-reports',
      client: makeFakeClient(),
      storage
    });

    assert.strictEqual(gcsPath, 'gs://cf-reports/my-app-2026-01-01-2026-01-01.zip');
    assert.strictEqual(uploadCalls.length, 1);
    assert.strictEqual(uploadCalls[0].bucketName, 'cf-reports');
    assert.strictEqual(uploadCalls[0].localPath, zipPath);
  });

  it('does not upload to GCS when no gcsBucket is configured', async () => {
    const { gcsPath } = await runExport({
      start: '2026-01-01',
      end: '2026-01-01',
      outputDir: tmpDir,
      appName: 'my-app',
      includeViews: ['top-pages'],
      zip: true,
      client: makeFakeClient()
    });

    assert.strictEqual(gcsPath, null);
  });

  it('skips bot-management views and warns when the capability probe fails', async () => {
    const { folderPath, skippedViews } = await runExport({
      start: '2026-01-01',
      end: '2026-01-01',
      outputDir: tmpDir,
      appName: 'my-app',
      client: makeFakeClient({ botManagementAvailable: false })
    });

    const files = await fs.promises.readdir(folderPath);
    assert.deepStrictEqual(files.sort(), ['api-calls.csv', 'country-breakdown.csv', 'top-pages.csv']);
    assert.deepStrictEqual(skippedViews.sort(), [
      'bot-page-views',
      'human-page-views',
      'unique-bot-visitors',
      'unique-human-visitors'
    ]);
  });

  it('throws on an unknown view name', async () => {
    await assert.rejects(
      () => runExport({
        start: '2026-01-01',
        end: '2026-01-01',
        outputDir: tmpDir,
        includeViews: ['not-a-real-view'],
        client: makeFakeClient()
      }),
      /Unknown view/
    );
  });
});
