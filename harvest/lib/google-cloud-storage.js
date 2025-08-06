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
    let localHash = null;
    if (fs.existsSync(fullFsFilePath)) {  // Check if local file exists
      localHash = await this.getLocalFileHash(fullFsFilePath);
    }
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

  async delete(filePath) {
    if( filePath.startsWith(this.rootDir) ) {
      filePath = filePath.replace(this.rootDir + '/', '');
    }
    const file = this.bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn(`File does not exist in GCS: ${filePath}`);
      return;
    }
    logger.info('Deleting file from GCS', { filePath, bucket: this.bucketName });
    return file.delete();
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

    // Ensure the directory exists
    await fs.ensureDir(path.dirname(fullFsFilePath));

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

  async uploadDirectory(dirPath, opts = {}) {
    logger.info(`Uploading directory to GCS: ${dirPath} from ${this.rootDir}`, { bucket: this.bucketName });
  
    let localFiles = await this.getAllFilesInDirectory(dirPath);
    for (const file of localFiles) {
      await this.upload(file);
    }

    if( opts.delete ) {
      // Note: this will list all files in the bucket with the given prefix
      // up to a certain limit (default is 1000 files).
      // If you have more files, you may need to handle pagination.
      const [files, nextQuery] = await this.bucket.getFiles({ prefix: dirPath });

      let diff = this.getFileDifference(
        localFiles,
        files
      );

      logger.info('Deleting file in GCS not in local directory', { files: diff.onlyInGcs, bucket: this.bucketName });
      for( let file of diff.onlyInGcs ) {
        await this.delete(file);
      }
    }
  }

  async downloadDirectory(dirPath, opts={}) {
    logger.info(`Downloading directory from GCS: ${dirPath} to ${this.rootDir}`, { bucket: this.bucketName });

    // Note: this will list all files in the bucket with the given prefix
    // up to a certain limit (default is 1000 files).
    // If you have more files, you may need to handle pagination.
    const [files, nextQuery] = await this.bucket.getFiles({ prefix: dirPath });
    for (const file of files) {
      await this.download(file.name);
    }

    if( opts.delete ) {
      let diff = this.getFileDifference(
        await this.getAllFilesInDirectory(dirPath),
        files
      );

      logger.info('Deleting local file not in GCS', { files: diff.onlyLocal, bucket: this.bucketName });
      for( let file of diff.onlyLocal ) {
        let fullFsFilePath = path.join(this.rootDir, file);
        if( fs.existsSync(fullFsFilePath) ) {
          logger.info('Deleting local file');
          await fs.remove(fullFsFilePath);
        }
      }
    }
  }

  async getAllFilesInDirectory(dirPath) {
    const fullDirPath = path.join(this.rootDir, dirPath);
    let results = [];

    if (!fs.existsSync(fullDirPath)) {
      return results;
    }

    const files = await fs.readdir(fullDirPath, { withFileTypes: true });

    for (const file of files) {
      const relativePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        const subFiles = await this.getAllFilesInDirectory(relativePath);
        results = results.concat(subFiles);
      } else if (file.isFile()) {
        results.push(relativePath);
      }
    }

    return results;
  }

  getFileDifference(localFiles, gcsFiles) {
    if( typeof gcsFiles[0] === 'object' && gcsFiles[0].name ) {
      gcsFiles = gcsFiles.map(file => file.name);
    }

    const set1 = new Set(localFiles);
    const set2 = new Set(gcsFiles);

    const diff1 = localFiles.filter(item => !set2.has(item));
    const diff2 = gcsFiles.filter(item => !set1.has(item));
    
    return {
      onlyLocal: diff1,
      onlyInGcs: diff2
    };
  }

}

export default GcsCache;