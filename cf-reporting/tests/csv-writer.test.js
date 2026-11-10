import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { rowsToCsv, writeCsvFile } from '../lib/csv-writer.js';

describe('lib/csv-writer.js', () => {
  describe('rowsToCsv', () => {
    it('writes a header row from the first row\'s keys', () => {
      const csv = rowsToCsv({ rows: [{ date: '2026-01-01', calls: 10 }] });
      assert.strictEqual(csv, 'date,calls\n2026-01-01,10\n');
    });

    it('uses explicit columns when given', () => {
      const csv = rowsToCsv({ rows: [{ a: 1, b: 2 }], columns: ['b', 'a'] });
      assert.strictEqual(csv, 'b,a\n2,1\n');
    });

    it('writes just a header row for an empty rows array', () => {
      const csv = rowsToCsv({ rows: [], columns: ['date', 'calls'] });
      assert.strictEqual(csv, 'date,calls\n');
    });

    it('quotes values containing commas', () => {
      const csv = rowsToCsv({ rows: [{ path: '/a,b' }] });
      assert.strictEqual(csv, 'path\n"/a,b"\n');
    });
  });

  describe('writeCsvFile', () => {
    it('creates parent directories and writes the file', async () => {
      const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cf-reporting-csv-'));
      const filePath = path.join(dir, 'nested', 'out.csv');

      await writeCsvFile({ rows: [{ a: 1 }], filePath });
      const contents = await fs.promises.readFile(filePath, 'utf8');

      assert.strictEqual(contents, 'a\n1\n');
      await fs.promises.rm(dir, { recursive: true, force: true });
    });
  });
});
