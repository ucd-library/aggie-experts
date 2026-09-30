/**
 * Google Cloud Storage helpers for the grant-feed ETL.
 *
 * The AE grant feed publishes a single object at a fixed GCS path and uses
 * generations (versions) as the immutable history; "generation 0" means the
 * most recent version, "generation 1" the one before, etc. This module
 * exposes:
 *   - parseGsUri(uri)                  split gs:// URIs
 *   - listGenerations(bucket, file)    newest-first array of generation ids
 *   - downloadGeneration(...)          download a specific generation to disk
 */
import fs from 'fs';
import { Storage } from '@google-cloud/storage';
import { logger } from '@ucd-lib/experts-commons';

/**
 * Split a `gs://bucket/path/to/file.xml` URI into its parts. Returns null
 * for anything else.
 */
export function parseGsUri(uri) {
  if (!uri || !uri.startsWith('gs://')) return null;
  const [, , bucket, ...rest] = uri.split('/');
  const filePath = rest.join('/');
  return {
    bucket,
    filePath,
    fileName: rest[rest.length - 1]
  };
}

/**
 * Return every generation id for `fileName` in `bucketName`, newest first.
 * GCS generation ids are int64 values (microseconds since the epoch) rendered
 * as numeric strings, and larger == newer. We sort them numerically with
 * BigInt rather than lexicographically: string ordering only matches numeric
 * ordering while all ids share the same digit-length, and the ids will exceed
 * Number.MAX_SAFE_INTEGER, so BigInt is the length- and precision-safe compare.
 */
export async function listGenerations(bucketName, fileName, { storage } = {}) {
  const client = storage || new Storage();
  const bucket = client.bucket(bucketName);
  const [files] = await bucket.getFiles({ versions: true });
  const generations = files
    .filter(f => f.name === fileName)
    .map(f => f.metadata.generation)
    .sort((a, b) => {
      const av = BigInt(a), bv = BigInt(b);
      return av > bv ? -1 : av < bv ? 1 : 0; // newest (largest) first
    });
  logger.info(`Found ${generations.length} generation(s) of ${fileName} in ${bucketName}`);
  return generations;
}

/**
 * Download the specified generation of a GCS object to a local path.
 */
export async function downloadGeneration(bucketName, fileName, destinationPath, generation, { storage } = {}) {
  const client = storage || new Storage();
  const bucket = client.bucket(bucketName);
  const file = bucket.file(fileName, { generation });
  logger.info(`Downloading gs://${bucketName}/${fileName} (gen ${generation}) -> ${destinationPath}`);
  const [data] = await file.download();
  fs.writeFileSync(destinationPath, data);
}

export default {
  parseGsUri,
  listGenerations,
  downloadGeneration
};
