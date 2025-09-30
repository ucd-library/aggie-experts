import fs from 'fs-extra';
import path from 'path';
import config from './config.js';
import logger from './logger.js';
import crypto from 'crypto';
import { reportFileWrite } from './reporting/index.js';
import GcsCache from './google-cloud-storage.js';
import CaskFS from '/opt/caskfs/src/index.js';
import { getWeek } from 'date-fns';


class FsCache {

  constructor() {
    this.rootDir = config.cache.rootDir;
    this.pgClient = null;
    // this.gcs = new GcsCache();
    this.caskFs = new CaskFS({
      rootDir: this.rootDir,
      postgres: config.cache.postgres
    })
  }

  getYearWeek(date) {
    if( !date ) date = new Date();
    let week = getWeek(date)+'';
    if( week.length === 1 ) week = '0'+week;
    return date.getFullYear()+'-'+week;
  }

  /**
   * @method getPath
   * @description Get the full file path for a user asset given the user ID and asset path
   *
   * @param {String} userId expert user ID
   * @param  {String} assetKey either a single string or multiple strings that form the asset path
   * @returns {String} full file path for the user asset
   */
  getPath(userId, assetKey, date) {
    if( typeof assetKey === 'object' && Array.isArray(assetKey) ) {
      assetKey = path.join(...assetKey);
    }
    return path.join('/', this.getYearWeek(date), userId, assetKey);
  }

  exists(assetPath) {
    return this.caskFs.exists(assetPath);
  }

  /**
   * @method existsUserAsset
   * @description Check if a user asset exists in the cache
   *
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   *
   * @returns {Boolean} true if the asset exists, false otherwise
   */
  existsUserAsset(userId, assetKey, date) {
    const assetPath = this.getPath(userId, assetKey, date);
    return this.caskFs.exists(assetPath);
  }

  readdir(dir) {
    return this.caskFs.ls({directory: dir});
  }

  /**
   * @method readUserAsset
   * @description Read a user asset from the cache
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   *
   * @returns {Promise<String>} the content of the user asset file
   */
  async readUserAsset(userId, assetKey, date) {
    const assetPath = this.getPath(userId, assetKey, date);
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
    if (! await this.caskFs.exists(assetPath)) {
      throw new Error(`Asset not found: ${assetPath}`);
    }
    return this.caskFs.read(assetPath, {encoding: 'utf8'});
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
   * @returns {Promise<Object>} an object containing the asset path, local cache write status, hash, and last modified date
   */
  async writeUserAsset(step, userId, assetKey, data, date) {
    const assetPath = this.getPath(userId, assetKey, date);
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
   * @returns {Promise<Object>} an object containing the asset path, local cache write status, hash, and last modified date
   */
  async write(step, assetPath, data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data, null, 2);
    }

    // let localCacheWrite = true, newHash, existingHash;
    // if (fs.existsSync(assetPath)) {
    //   existingHash = await this.hashFile(assetPath);
    //   newHash = crypto.createHash('sha256').update(data).digest('hex');
    //   if (existingHash === newHash) {
    //     localCacheWrite = false;
    //   }
    // }

    // if (localCacheWrite === true) {
    //   await fs.writeFile(assetPath, data);
    // }

    let resp = await this.caskFs.write(
      await this.caskFs.createContext({file: assetPath}), 
      {data, replace: true}
    );

    // const stats = await fs.stat(assetPath);
    // let lastModified = stats.mtime.toISOString();

    // new file or file changed, report the write
    // if( !newHash ) {
    //   newHash = await this.hashFile(assetPath);
    // }

    // push file to gcs if configured.  This will return false if the file already exists and is unchanged.
    // if the file did not change, set the proper last modified date
    // let gcsWrite = await this.writeToGcs(assetPath);
    // if( gcsWrite === false ) {
    //   const gcsLastModified = await this.gcs.getLastModified(assetPath);
    //   if( gcsLastModified ) {
    //     fs.utimesSync(assetPath, gcsLastModified, gcsLastModified);
    //   }
    //   lastModified = gcsLastModified.toISOString();
    // }
    let gcsWrite = false;

    await reportFileWrite({
      file_path: assetPath,
      step: step,
      last_modified: resp.file.modified,
      file_hash: resp.file.digests[resp.primaryDigest],
      last_file_hash: resp.replacedFile?.digests?.[resp.primaryDigest] || null,
      local_cache_write: resp.copied ? true : false,
      gcs_write: gcsWrite
    });

    return {
      assetPath,
      localCacheWrite: resp.copied ? true : false,
      gcsWrite,
      hash: resp.file.digests[resp.primaryDigest],
      lastModified : resp.file.modified
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
  getFileStats(assetPath) {
    return this.caskFs.metadata(assetPath);
  }


  /**
   * @method deleteUserAsset
   * @description Delete a user asset from the cache.  This method deletes the asset from both local filesystem and Google Cloud Storage if configured.
   *
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * @returns {Promise<void>}
   */
  async deleteUserAsset(userId, assetKey, date) {
    const assetPath = this.getPath(userId, assetKey, date);
    if (await this.caskFs.exists(assetPath)) {
      await this.caskFs.delete(await this.caskFs.createContext({file: assetPath}));
    }
    // await this.deleteFromGcs(assetPath);
  }

  async delete(assetPath) {
    if (await this.caskFs.exists(assetPath)) {
      await this.caskFs.delete(await this.caskFs.createContext({file: assetPath}));
    }
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
  async writeToGcs(filePath) {
    if (!config.cache.gcs.enabled) {
      return null;
    }
    return (await this.gcs.upload(filePath)) ? true : false;
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

  close() {
    return this.caskFs.close();
  }

}

export default new FsCache();
