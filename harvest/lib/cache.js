import path from 'path';
import config from './config.js';
// import { reportFileWrite } from './reporting/index.js';
import CaskFS from '/opt/caskfs/src/index.js';
import { getYearWeek } from './year-week.js';
import os from 'os';

class FsCache {

  constructor() {
    this.rootDir = config.cache.rootDir;
    this.pgClient = null;
    // this.gcs = new GcsCache();

    this.roots = {
      weekly: '/weekly',
      archive: '/archive'
    }
    this.validRoots = Object.values(this.roots);

    this.scholarlyWorkType = ['work', 'grant'];

    let requestor = os.userInfo().username;
    if( !requestor || requestor === 'root' ) {
      requestor = 'aggie-experts-harvest';
    }
    this.caskRequestor = requestor;

    this.caskFs = new CaskFS({
      rootDir: this.rootDir,
      postgres: config.postgres,
      dbPool : config.cache.poolDbConnection
    });

    this.findRelatedExpertsCache = new Map();
  }

  async init() {
    await this.caskFs.dbClient.init();
    for( let partition of config.cache.autoPathPartitions ) {
      await this.caskFs.autoPath.partition.set(partition);
    }
  }

  /**
   * @method getPath
   * @description Get the full file path for a user asset given the user ID and asset path
   *
   * @param {Object} opts options object
   * @param {String} opts.root root directory to use, either 'weekly' or 'archive', defaults to 'archive'
   * @param {Date} opts.date date object to determine the year-week directory, defaults to current date
   * 
   * @returns {String} full file path for the user asset
   */
  getPath(opts={}) {
    if( !opts.root ) opts.root = this.roots.weekly;
    if( !this.validRoots.includes(opts.root) ) {
      throw new Error(`Invalid root specified: ${opts.root}`);
    }

    if( opts.root === this.roots.archive ) {
      return opts.root;
    }

    return path.join(opts.root, getYearWeek({date: opts.date}));
  }

  /**
   * @method getUserPath
   * @description Get the full file path for a user asset given the user ID and asset path
   *
   * @param {String} userId expert user ID
   * @param  {String} assetKey either a single string or multiple strings that form the asset path
   * @param {Object} opts options object
   * @param {String} opts.root root directory to use, either 'weekly' or 'archive', defaults to 'archive'
   * @param {Date} opts.date date object to determine the year-week directory, defaults to current date
   * 
   * @returns {String} full file path for the user asset
   */
  getUserPath(userId, assetKey, opts={}) {
    let rootPath = this.getPath(opts);
    if( Array.isArray(assetKey) ) {
      return path.join(rootPath, 'users', userId, ...assetKey);
    }
    return path.join(rootPath, 'users', userId, assetKey);
  }

  getScholarlyWorkPath(type, assetKey, opts={}) {
    if( !this.scholarlyWorkType.includes(type) ) {
      throw new Error(`Invalid scholarly work type specified: ${type}`);
    }
    let rootPath = this.getPath(opts);
    if( Array.isArray(assetKey) ) {
      return path.join(rootPath, type, ...assetKey);
    }
    return path.join(rootPath, type, assetKey);
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
    const assetPath = this.getUserPath(userId, assetKey, opts);
    return this.exists(assetPath);
  }

  /**
   * @method readdir
   * @description Read the contents of a directory in the cache
   * @param {String} dir full path to the directory
   * @param {Boolean} allFiles if true, will return all files in the directory, otherwise will limit to default limit
   * @returns {Promise<Object>} an object directory listing with 'file' and 'directory' arrays
   */
  async readdir(dir, allFiles=false) {
    if( allFiles ) {
      // loop through 500 file increments to get all files
      let allResults = { files: [], directories: [] };
      let limit = 500;
      let offset = 0;
      let filesFetched = 0;
      let totalCount = 0;
 
      do {
        let res = await this.caskFs.ls({
          directory: dir,
          limit,
          offset,
          requestor: this.caskRequestor
        });
        allResults.files.push(...res.files);
        allResults.directories.push(...res.directories);
        filesFetched += res.files.length;
        totalCount = res.totalCount || 0;
        offset += limit;
      } while ( filesFetched < totalCount );

      return allResults;

    } else {
      return await this.caskFs.ls({
        directory: dir,
        requestor: this.caskRequestor
      });
    }
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
    const assetPath = this.getUserPath(userId, assetKey, opts);
    return this.read(assetPath);
  }

  async readScholarlyAsset(type, assetKey, opts={}) {
    const assetPath = this.getScholarlyWorkPath(type, assetKey, opts);
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
    const assetPath = this.getUserPath(userId, assetKey, opts);
    return this.write(step, assetPath, data);
  }

  async writeScholarlyAsset(step, type, assetKey, data, opts={}) {
    const assetPath = this.getScholarlyWorkPath(type, assetKey, opts);
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

    let resp = await this.caskFs.write({
      filePath: assetPath,
      data,
      replace: true,
      requestor: this.caskRequestor
    });
    resp = resp.data;

    return {
      assetPath,
      localCacheWrite: resp.copied ? true : false,
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
   * @param {Boolean} opts.isDirectory if true, will delete a directory instead of a file
   * @param {Boolean} opts.softDelete if true, will perform a soft delete by deleting entry but not hash file on disk
   * 
   * @returns {Promise<void>}
   */
  async deleteUserAsset(userId, assetKey, opts={}) {
    const assetPath = this.getUserPath(userId, assetKey, opts);
    return this.delete(assetPath, opts);
  }

  /**
   * @method delete
   * @description Delete a file from the cache
   *
   * @param {String} assetPath full path to the asset file
   * @param {Object} opts options object
   * @param {Boolean} opts.isDirectory if true, will delete a directory instead of a file
   * @param {Boolean} opts.softDelete if true, will perform a soft delete by deleting entry but not hash file on disk
   *
   * @returns {Promise<void>}
   */
  async delete(assetPath, opts={}) {
    if ( opts.isDirectory ) {
      await this.caskFs.deleteDirectory({
        directory: assetPath,
        requestor: this.caskRequestor,
        softDelete: opts.softDelete || false
      });
      return;
    }

    await this.caskFs.deleteFile({
      filePath: assetPath,
      requestor: this.caskRequestor,
      softDelete: opts.softDelete || false
    });
  }

  /**
   * @method findRelatedExperts
   * @description Find related experts for a given subject by querying the RDF data in the cache.  
   * This method uses an in-memory cache to avoid redundant queries for the same subject and partition keys.
   * 
   * @param {String} subject 
   * @param {Object} opts options object
   * @param {Array} opts.partitionKeys array of partition keys
   * @param {Boolean} opts.limit if true, will limit the number of results returned (default: false)
   * 
   * @returns {Promise<Object>} RDF response object containing related files from cask
   */
  async findRelatedExperts(subject, opts={}) {
    if( !opts.partitionKeys ) {
      opts.partitionKeys = [];
    }
    const partitionKeys = opts.partitionKeys;
    let query = { subject, partitionKeys };
    const limit = opts.limit || false;
    if( limit ) {
      query.limit = limit;
    }

    const cacheKey = `${subject}|${partitionKeys.join('|')}|${limit}`;
    if (this.findRelatedExpertsCache.has(cacheKey)) {
      return this.findRelatedExpertsCache.get(cacheKey);
    }

    const rdfResp = await this.caskFs.rdf.find(query);
    this.findRelatedExpertsCache.set(cacheKey, rdfResp);

    return rdfResp;
  }


  close() {
    return this.caskFs.close();
  }

}

export default new FsCache();
