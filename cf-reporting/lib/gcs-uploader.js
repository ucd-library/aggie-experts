import { Storage } from '@google-cloud/storage';
import logger from './logger.js';

/**
 * @description Uploads a local file to a Google Cloud Storage bucket.
 * @param {string} bucketName - Destination bucket name.
 * @param {string} localPath - Path to the local file to upload.
 * @param {string} destName - Object name to give the file in the bucket.
 * @param {Object} [opts={}]
 * @param {Object} [opts.storage] - Injectable Storage client, mainly for tests.
 * @returns {Promise<string>} The resulting `gs://` URI.
 */
export async function uploadFile(bucketName, localPath, destName, opts = {}) {
  const client = opts.storage || new Storage();
  const gsUri = `gs://${bucketName}/${destName}`;
  logger.info(`Uploading ${localPath} -> ${gsUri}`);
  await client.bucket(bucketName).upload(localPath, { destination: destName });
  return gsUri;
}

export default { uploadFile };
