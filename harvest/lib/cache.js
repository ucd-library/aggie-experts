import fs from 'fs-extra';
import path from 'path';
import config from './config.js';
import logger from './logger.js';
import crypto from 'crypto';
import { reportFileWrite } from './reporting/index.js';
import GcsCache from './google-cloud-storage.js';

class FsCache {

  constructor() {
    this.rootDir = config.cache.rootDir;
    this.pgClient = null;
    this.gcs = new GcsCache();
  }

  /**
   * @method getPath
   * @description Get the full file path for a user asset given the user ID and asset path
   * 
   * @param {String} userId expert user ID
   * @param  {...String} assetKey either a single string or multiple strings that form the asset path
   * @returns {String} full file path for the user asset  
   */
  getPath(userId, ...assetKey) {
    return path.join(this.rootDir, userId, ...assetKey);
  }

  /**
   * @method exists
   * @description Check if a user asset exists in the cache
   * 
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * 
   * @returns {Boolean} true if the asset exists, false otherwise
   */
  exists(userId, assetKey) {
    const assetPath = this.getPath(userId, assetKey);
    return fs.existsSync(assetPath);
  }

  /**
   * @method readUserAsset
   * @description Read a user asset from the cache
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * 
   * @returns {Promise<String>} the content of the user asset file
   */
  async readUserAsset(userId, assetKey) {
    const assetPath = this.getPath(userId, assetKey);
    return this.read(assetPath);
  }

  /**
   * @method read
   * @description Read a file from the cache
   * 
   * @param {String} assetPath full path to the asset file
   * 
   * @returns {Promise<String>} the content of the file
   */
  async read(assetPath) {
    if (!fs.existsSync(assetPath)) {
      throw new Error(`Asset not found: ${assetPath}`);
    }
    return fs.readFile(assetPath, 'utf8');
  }

  /**
   * @method writeUserAsset
   * @description Write a user asset to the cache.  See `write` method for details.
   * 
   * @param {String} step the step of the process (e.g., 'extract', 'transform')
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * @param {Object|String} data the data to write, can be an object or a string
   * 
   * @returns {Promise<Object>} an object containing the asset path, noOp status, hash, and last modified date
   */
  async writeUserAsset(step, userId, assetKey, data) {
    const assetPath = this.getPath(userId, assetKey);
    return this.write(step, assetPath, data);
  }

  /**
   * @method write
   * @description Write data to a file in the cache.  This method handles writing to both local filesystem and Google Cloud Storage if configured.
   * It checks if the file already exists and compares hashes to avoid unnecessary writes to both local and cloud storage.  Any
   * directories in the path will be created if they do not exist.
   * 
   * @param {String} step the step of the process (e.g., 'extract', 'transform')
   * @param {String} assetPath full path to the asset file
   * @param {Object|String} data the data to write, can be an object or a string
   * 
   * @returns {Promise<Object>} an object containing the asset path, noOp status, hash, and last modified date
   */
  async write(step, assetPath, data) {
    await fs.ensureDir(path.dirname(assetPath));

    if (typeof data === 'object') {
      data = JSON.stringify(data, null, 2);
    }

    let noOp = false, newHash, existingHash;
    if (fs.existsSync(assetPath)) {
      existingHash = await this.hashFile(assetPath);
      newHash = crypto.createHash('sha256').update(data).digest('hex');
      if (existingHash === newHash) {
        noOp = true;
      }
    }

    if (noOp === false) {
      await fs.writeFile(assetPath, data);
    }

    const stats = await fs.stat(assetPath);
    const lastModified = stats.mtime.toISOString();

    // new file or file changed, report the write
    if( !newHash ) {
      newHash = await this.hashFile(assetPath);
    }

    await this.writeToGcs(assetPath);

    await reportFileWrite({
      file_path: assetPath,
      step: step,
      last_modified: lastModified,
      file_hash: newHash,
      last_file_hash: existingHash,
      no_op: noOp
    });

    return {
      assetPath,
      noOp,
      hash: newHash,
      lastModified
    };
  }

  /**
   * @method getFileStats
   * @description Get statistics for a file in the cache.
   * 
   * @param {String} assetPath full path to the asset file
   * 
   * @returns {Promise<Object>} an object containing the asset path, hash, and last modified date
   */
  async getFileStats(assetPath) {
    return {
      assetPath,
      hash: await this.hashFile(assetPath),
      lastModified: (await fs.stat(assetPath)).mtime.toISOString()
    }
  }

  /**
   * @method hashFile
   * @description Generate a SHA-256 hash for a file.
   * 
   * @param {String} filePath full path to the file
   * 
   * @returns {Promise<String>} the SHA-256 hash of the file
   */
  async hashFile(filePath) {
    const hash = crypto.createHash('sha256');
    const fileStream = fs.createReadStream(filePath);
    return new Promise((resolve, reject) => {
      fileStream.on('data', (data) => {
        hash.update(data);
      });
      fileStream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      fileStream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * @method delete
   * @description Delete a user asset from the cache.  This method deletes the asset from both local filesystem and Google Cloud Storage if configured.
   * 
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * @returns {Promise<void>}
   */
  async delete(userId, assetKey) {
    const assetPath = this.getPath(userId, assetKey);
    if (fs.existsSync(assetPath)) {
      await fs.remove(assetPath);
    }
    await this.deleteFromGcs(assetPath);
  }

  /**
   * @method deleteFromGcs
   * @description Delete a file from Google Cloud Storage if configured.
   * 
   * @param {String} filePath full path to the file in GCS
   * @returns {Promise<void>}
   */
  deleteFromGcs(filePath) {
    if (!config.cache.gcs.enabled) {
      return;
    }
    return this.gcs.delete(filePath);
  }

  /**
   * @method writeToGcs
   * @description Write a file to Google Cloud Storage if configured.
   * 
   * @param {String} filePath full path to the file
   * @returns {Promise<void>}
   */
  writeToGcs(filePath) {
    if (!config.cache.gcs.enabled) {
      return;
    }
    return this.gcs.upload(filePath);
  }

  /**
   * @method readFromGcs
   * @description Read a file from Google Cloud Storage if configured.
   * 
   * @param {String} filePath full path to the file
   * @returns {Promise<void>}
   */
  readFromGcs(filePath) {
    if (!config.cache.gcs.enabled) {
      return;
    }
    return this.gcs.download(filePath);
  }

}

export default new FsCache();