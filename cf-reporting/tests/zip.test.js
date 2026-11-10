import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zipDirectory from '../lib/zip.js';

describe('lib/zip.js', () => {
  it('zips a directory into a non-empty valid zip file', async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cf-reporting-zip-'));
    const sourceDir = path.join(dir, 'my-export');
    await fs.promises.mkdir(sourceDir, { recursive: true });
    await fs.promises.writeFile(path.join(sourceDir, 'a.csv'), 'a,b\n1,2\n');

    const zipPath = path.join(dir, 'my-export.zip');
    await zipDirectory(sourceDir, zipPath);

    const stat = await fs.promises.stat(zipPath);
    assert.ok(stat.size > 0);

    const header = Buffer.alloc(2);
    const fd = await fs.promises.open(zipPath, 'r');
    await fd.read(header, 0, 2, 0);
    await fd.close();
    assert.strictEqual(header.toString('ascii'), 'PK');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });
});
