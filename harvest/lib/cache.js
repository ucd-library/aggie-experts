import path from 'path';
import config from './config.js';
import { reportFileWrite } from './reporting/index.js';
import CaskFS from '/opt/caskfs/src/index.js';
import { getWeek, startOfYear, nextSaturday, isSaturday } from 'date-fns';
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

    let requestor = os.userInfo().username;
    if( !requestor || requestor === 'root' ) {
      requestor = 'aggie-experts-harvest';
    }
    this.caskRequestor = requestor;

    this.caskFs = new CaskFS({
      rootDir: this.rootDir,
      postgres: config.cache.postgres,
      dbPool : config.cache.poolDbConnection,
    })
  }

  async init() {
    await this.caskFs.dbClient.init();
    for( let partition of config.cache.autoPathPartitions ) {
      await this.caskFs.autoPath.partition.set(partition);
    }
  }

  /**
   * @method getYearWeek
   * @description Get the year-week string (format: YYYY-WW) for a given date.  Weeks start on Saturday.
   * Prior to the first Saturday of the year is considered week 52/53 of the previous year.
   * 
   * Note: this math is a pain.  Always use this method to get year-week instead of trying to calculate it yourself.
   * 
   * @param {Object} date Date object, defaults to current date
   * @param {Object} opts options object
   * @param {Boolean} opts.allValues if true, will return 'all' for year-week instead of calculating it
   * 
   * @returns {String} year-week string in format YYYY-WW
   */
  getYearWeek(date, opts={}) {
    if( !date ) date = new Date();

    // for prior year calculations, we need to set the original date
    if( !opts.date ) opts.date = date;

    // find first Saturday of the year
    let yearOffset = new Date(date.getFullYear(), 0, 1, 0, 0, 0).getDay();
    let firstSat = null

    // if Jan 1 is a Saturday, week 1 starts that day
    if( yearOffset === 6 ) {
      firstSat = new Date(date.getFullYear(), 0, 1, 0, 0, 0);

    // otherwise, week 1 starts the first Saturday on or after Jan 1
    } else {
      firstSat = new Date(date.getFullYear(), 0, (6-yearOffset)+1, 0, 0, 0);

      // date is in week 52/53 of previous year
      if( date < firstSat ) {
        const prevYearDate = new Date(date.getFullYear()-1, 11, 31, 0, 0, 0);
        return this.getYearWeek(prevYearDate, opts);
      }
    }

    // calculate week number, starting with week 1 on first Saturday
    let week = 1, weekStart, weekEnd;
    while( week <= 53 ) {
      weekStart = new Date(firstSat);
      weekStart.setDate(firstSat.getDate() + ((week-1)*7));
      weekEnd = new Date(firstSat);
      weekEnd.setDate(firstSat.getDate() + ((week)*7) - 1);

      if( date >= weekStart && date <= weekEnd ) {
        break;
      }
      week++;
    }

    const year = date.getFullYear();

    // pad week with leading zero if needed
    if( (week+'').length === 1 ) week = '0'+week;

    if( opts.allValues ) {
      return {
        yearWeek : year+'-'+week,
        weekStart,
        weekEnd,
        date: opts.date
      }
    }

    return year+'-'+week;
  }

  /**
   * @method getPath
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
  getPath(userId, assetKey, opts={}) {
    if( typeof assetKey === 'object' && Array.isArray(assetKey) ) {
      assetKey = path.join(...assetKey);
    }
    if( !opts.root ) opts.root = this.roots.weekly;
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

    await reportFileWrite({
      file_path: assetPath,
      step: step,
      last_modified: resp.file.modified,
      file_hash: resp.file.digests[resp.primaryDigest],
      last_file_hash: resp.replacedFile?.digests?.[resp.primaryDigest] || null,
      local_cache_write: resp.copied ? true : false
    });

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

  close() {
    return this.caskFs.close();
  }

}

export default new FsCache();
