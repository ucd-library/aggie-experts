import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';

/**
 * @description Zip a directory so it becomes the single top-level entry in the
 * resulting archive - uses a real zip library (rather than shelling out to the
 * OS zip tool) for consistent cross-platform behavior.
 * @param {string} dirPath - Directory to zip (its basename becomes the zip's root entry).
 * @param {string} zipPath - Output .zip file path.
 * @returns {Promise<void>}
 */
export async function zipDirectory(dirPath, zipPath) {
  const rootName = path.basename(dirPath);

  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  const closed = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);
  archive.directory(dirPath, rootName);
  await archive.finalize();
  await closed;
}

export default zipDirectory;
