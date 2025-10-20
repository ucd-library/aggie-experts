import fs from 'fs-extra';
import path from 'path';
import config from './config.js';
import logger from './logger.js';
import crypto from 'crypto';
import { reportFileWrite } from './reporting/index.js';
import GcsCache from './google-cloud-storage.js';
import CaskFS from '/opt/caskfs/src/index.js';
import { getWeek } from 'date-fns';
import os from 'os';

class FsCache {

  constructor() {
    this.rootDir = config.cache.rootDir;
    this.pgClient = null;
    // this.gcs = new GcsCache();

    this.roots = {
      active : '/active',
      archive: '/archive'
    }
    this.validRoots = Object.values(this.roots);

    let requestor = os.userInfo().username;
    if( !requestor || requestor === 'root' ) {
      requestor = 'aggie-experts-harvest';
    }
    this.caskRequestor = requestor;

    this.caskFs = new CaskFS({
      rootDir: this.rootDir,
      postgres: config.cache.postgres
    })
  }

  // init() {
  //   return this.caskFs.init();
  // }

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
   * @param {Object} opts options object
   * @param {String} opts.root root directory to use, either 'active' or 'archive', defaults to 'active'
   * @param {Date} opts.date date object to determine the year-week directory, defaults to current date
   * 
   * @returns {String} full file path for the user asset
   */
  getPath(userId, assetKey, opts={}) {
    if( typeof assetKey === 'object' && Array.isArray(assetKey) ) {
      assetKey = path.join(...assetKey);
    }
    if( !opts.root ) opts.root = this.roots.active;
    if( !this.validRoots.includes(opts.root) ) {
      throw new Error(`Invalid root specified: ${opts.root}`);
    }

    if( opts.root === this.roots.archive ) {
      return path.join(opts.root, userId, assetKey);
    }

    return path.join(opts.root, this.getYearWeek(opts.date), userId, assetKey);
  }

  /**
   * @method exists
   * @description Check if a file exists in the cache
   * 
   * @param {String} assetPath full path to the asset file
   * 
   * @returns {Boolean} true if the file exists, false otherwise
   */
  exists(assetPath) {
    return this.caskFs.exists({
      filePath: assetPath,
      requestor: this.caskRequestor
    });
  }

  /**
   * @method existsUserAsset
   * @description Check if a user asset exists in the cache
   *
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * @param {Object} opts options object
   * @param {String} opts.root root directory to use, either 'active' or 'archive', defaults to 'active'
   * @param {Date} opts.date date object to determine the year-week directory, defaults to current date
   *
   * @returns {Boolean} true if the asset exists, false otherwise
   */
  existsUserAsset(userId, assetKey, opts={}) {
    const assetPath = this.getPath(userId, assetKey, opts);
    return this.exists(assetPath);
  }

  /**
   * @method readdir
   * @description Read the contents of a directory in the cache
   * @param {String} dir full path to the directory
   * @returns {Promise<Object>} an object directory listing with 'file' and 'directory' arrays
   */
  readdir(dir) {
    return this.caskFs.ls({
      directory: dir,
      requestor: this.caskRequestor
    });
  }

  /**
   * @method readUserAsset
   * @description Read a user asset from the cache
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * @param {Object} opts options object
   * @param {String} opts.root root directory to use, either 'active' or 'archive', defaults to 'active'
   * @param {Date} opts.date date object to determine the year-week directory, defaults to current date
   * 
   * @returns {Promise<String>} the content of the user asset file
   */
  async readUserAsset(userId, assetKey, opts={}) {
    const assetPath = this.getPath(userId, assetKey, opts);
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
    if (! await this.exists(assetPath)) {
      throw new Error(`Asset not found: ${assetPath}`);
    }
    return this.caskFs.read({
      filePath: assetPath,
      requestor: this.caskRequestor
    }, {encoding: 'utf8'});
  }

  /**
   * @method writeUserAsset
   * @description Write a user asset to the cache.  See `write` method for details.
   *
   * @param {String} step the step of the process (e.g., 'extract', 'transform')
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * @param {Object|String} data the data to write, can be an object or a string
   * @param {Object} opts options object
   * @param {String} opts.root root directory to use, either 'active' or 'archive', defaults to 'active'
   * @param {Date} opts.date date object to determine the year-week directory, defaults to current date
   * 
   * @returns {Promise<Object>} an object containing the asset path, local cache write status, hash, and last modified date
   */
  async writeUserAsset(step, userId, assetKey, data, opts={}) {
    const assetPath = this.getPath(userId, assetKey, opts);
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

    let resp = await this.caskFs.write({
      filePath: assetPath,
      data,
      replace: true,
      requestor: this.caskRequestor
    });
    resp = resp.data;

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
    return this.caskFs.metadata({
      filePath: assetPath,
      requestor: this.caskRequestor
    });
  }


  /**
   * @method deleteUserAsset
   * @description Delete a user asset from the cache.  This method deletes the asset from both local filesystem and Google Cloud Storage if configured.
   *
   * @param {String} userId expert user ID
   * @param {String} assetKey asset key (file path)
   * @param {Object} opts options object
   * @param {String} opts.root root directory to use, either 'active' or 'archive', defaults to 'active'
   * @param {Date} opts.date date object to determine the year-week directory, defaults to current date
   * 
   * @returns {Promise<void>}
   */
  async deleteUserAsset(userId, assetKey, opts={}) {
    const assetPath = this.getPath(userId, assetKey, opts);
    return this.delete(assetPath);
    // await this.deleteFromGcs(assetPath);
  }

  /**
   * @method delete
   * @description Delete a file from the cache
   *
   * @param {String} assetPath full path to the asset file
   *
   * @returns {Promise<void>}
   */
  async delete(assetPath) {
    if (await this.exists(assetPath)) {
      await this.caskFs.delete({
        filePath: assetPath,
        requestor: this.caskRequestor
      });
    }
  }

  /**
   * @method deleteFromGcs
   * @description Delete a file from Google Cloud Storage if configured.
   *
   * @param {String} filePath full path to the file in GCS
   * @returns {Promise<void>}
   */
  // deleteFromGcs(filePath) {
  //   if (!config.cache.gcs.enabled) {
  //     return;
  //   }
  //   return this.gcs.delete(filePath);
  // }

  /**
   * @method writeToGcs
   * @description Write a file to Google Cloud Storage if configured.
   *
   * @param {String} filePath full path to the file
   * @returns {Promise<void>}
   */
  // async writeToGcs(filePath) {
  //   if (!config.cache.gcs.enabled) {
  //     return null;
  //   }
  //   return (await this.gcs.upload(filePath)) ? true : false;
  // }

  /**
   * @method readFromGcs
   * @description Read a file from Google Cloud Storage if configured.
   *
   * @param {String} filePath full path to the file
   * @returns {Promise<void>}
   */
  // readFromGcs(filePath) {
  //   if (!config.cache.gcs.enabled) {
  //     return;
  //   }
  //   return this.gcs.download(filePath);
  // }

  close() {
    return this.caskFs.close();
  }

}

export default new FsCache();
