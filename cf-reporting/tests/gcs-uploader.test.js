import assert from 'assert';
import { uploadFile } from '../lib/gcs-uploader.js';

/**
 * @description A stubbed @google-cloud/storage Storage client that records
 * the bucket/upload calls made against it instead of touching real GCS.
 * @returns {Object}
 */
function makeFakeStorage() {
  const calls = [];
  return {
    calls,
    bucket(bucketName) {
      return {
        async upload(localPath, options) {
          calls.push({ bucketName, localPath, options });
        }
      };
    }
  };
}

describe('lib/gcs-uploader.js', () => {
  it('uploads the local file to the given bucket under the given destination name', async () => {
    const storage = makeFakeStorage();

    const gsUri = await uploadFile('cf-reports', '/tmp/my-export.zip', 'my-export.zip', { storage });

    assert.strictEqual(gsUri, 'gs://cf-reports/my-export.zip');
    assert.strictEqual(storage.calls.length, 1);
    assert.deepStrictEqual(storage.calls[0], {
      bucketName: 'cf-reports',
      localPath: '/tmp/my-export.zip',
      options: { destination: 'my-export.zip' }
    });
  });
});
