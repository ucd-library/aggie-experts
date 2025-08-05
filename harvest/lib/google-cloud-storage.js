import { Storage } from '@google-cloud/storage';
import fs from 'fs-extra';
import crypto from 'crypto';
import config from './config.js';
import logger from './logger.js';
import path from 'path';

class GcsCache {

  constructor() {
    this.storage = new Storage({
      keyFilename: config.userConfig.serviceAccountFile
    });
    this.rootDir = config.cache.rootDir;
    this.bucketName = config.cache.gcs.bucketName;
    this.bucket = this.storage.bucket(this.bucketName);
  }

  getLocalFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async getGcsFileHash(filePath) {
    let exists = (await this.bucket.file(filePath).exists())[0];
    if (!exists) {
      return null; // File does not exist in GCS
    }

    const [metadata] = await this.bucket.file(filePath).getMetadata();
    // GCS stores MD5 hash as base64, convert to hex
    if (metadata.md5Hash) {
      return Buffer.from(metadata.md5Hash, 'base64').toString('hex');
    }
    return null;
  }

  async filesChanged(filePath) {
    let fullFsFilePath = path.join(this.rootDir, filePath);
    const localHash = await this.getLocalFileHash(fullFsFilePath);
    const gcsHash = await this.getGcsFileHash(filePath);


    if (localHash === gcsHash) {
      logger.info('File is already in sync with GCS', { filePath, bucket: this.bucketName });
      return false; // No changes
    }

    return true;
  }

  async upload(filePath) {
    if( filePath.startsWith(this.rootDir) ) {
      filePath = filePath.replace(this.rootDir + '/', '');
    }
    let fullFsFilePath = path.join(this.rootDir, filePath);

    if( !fs.existsSync(fullFsFilePath) ) {
      throw new Error(`File does not exist: ${fullFsFilePath}`);
    }
    if( !(await this.filesChanged(filePath) ) ) {
      return false; // No changes
    }

    logger.info('Uploading file to GCS', { filePath, bucket: this.bucketName });
    return this.bucket.upload(fullFsFilePath, {
      destination: filePath,
      metadata: {
        metadata: {
          fsLastModifiedTime: (await fs.stat(fullFsFilePath)).mtime.toISOString()
        }
      }
    });
  }

  async download(filePath) {
    if( filePath.startsWith(this.rootDir) ) {
      filePath = filePath.replace(this.rootDir + '/', '');
    }
    let fullFsFilePath = path.join(this.rootDir, filePath);

    if( !(await this.filesChanged(filePath) ) ) {
      return false; // No changes
    }

    logger.info('Downloading file from GCS', { filePath, bucket: this.bucketName });

    const options = {
      destination: fullFsFilePath,
    };
    await this.bucket.file(filePath).download(options);

    // get the file metadata to check last modified time
    const [metadata] = await this.bucket.file(filePath).getMetadata();
    if (metadata && metadata.metadata && metadata.metadata.fsLastModifiedTime) {
      const lastModified = new Date(metadata.metadata.fsLastModifiedTime);
      fs.utimesSync(fullFsFilePath, lastModified, lastModified);
    }

  }

  async uploadDirectory(dirPath, gcsDir = '') {
    const fullDirPath = path.join(this.rootDir, dirPath);
    const files = fs.readdirSync(fullDirPath, { withFileTypes: true });

    for (const file of files) {
      const localRelativePath = path.join(dirPath, file.name);
      const gcsRelativePath = path.join(gcsDir, file.name);

      if (file.isDirectory()) {
        await this.uploadDirectory(localRelativePath, gcsRelativePath);
      } else if (file.isFile()) {
        await this.upload(localRelativePath);
      }
    }
  }

  async downloadDirectory(gcsDir = '', localDir = '') {
    const fullLocalDir = path.join(this.rootDir, localDir);
    if (!fs.existsSync(fullLocalDir)) {
      fs.mkdirSync(fullLocalDir, { recursive: true });
    }

    const [files] = await this.bucket.getFiles({ prefix: gcsDir });
    for (const file of files) {
      const relativePath = path.relative(gcsDir, file.name);
      if (relativePath.startsWith('..') || relativePath === '') continue;
      const localFilePath = path.join(localDir, relativePath);
      const fullLocalFilePath = path.join(this.rootDir, localFilePath);

      if (file.name.endsWith('/')) {
        // Directory, ensure exists
        if (!fs.existsSync(fullLocalFilePath)) {
          fs.mkdirSync(fullLocalFilePath, { recursive: true });
        }
      } else {
        // File, download
        const dirName = path.dirname(fullLocalFilePath);
        if (!fs.existsSync(dirName)) {
          fs.mkdirSync(dirName, { recursive: true });
        }
        await this.download(localDir + '/' + file.name);
        await this.bucket.file(file.name).download({ destination: fullLocalFilePath });
      }
    }
  }

}

export default GcsCache;