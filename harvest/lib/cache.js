import fs from 'fs-extra';
import path from 'path';
import config from './config.js';
import logger from './logger.js';

class FsCache {

  constructor() {
    this.rootDir = config.cache.rootDir;
  }

  updateRootDir(newRootDir) {
    logger.info(`Updating cache root directory from ${this.rootDir} to ${newRootDir}`);
    this.rootDir = newRootDir;
  }

  getPath(userId, ...assetKey) {
    return path.join(this.rootDir, userId, ...assetKey);
  }

  exists(userId, assetKey) {
    const assetPath = this.getPath(userId, assetKey);
    return fs.existsSync(assetPath);
  }

  async readUserAsset(userId, assetKey) {
    const assetPath = this.getPath(userId, assetKey);
    return this.read(assetPath);
  }

  async read(assetPath) {
    if (!fs.existsSync(assetPath)) {
      throw new Error(`Asset not found: ${assetPath}`);
    }
    return fs.readFile(assetPath, 'utf8');
  }

  async writeUserAsset(userId, assetKey, data) {
    const assetPath = this.getPath(userId, assetKey);
    return this.write(assetPath, data);
  }

  async write(assetPath, data) {
    await fs.ensureDir(path.dirname(assetPath));

    if (typeof data === 'object') {
      data = JSON.stringify(data, null, 2);
    }

    await fs.writeFile(assetPath, data);
    return assetPath;
  }

  async delete(userId, assetKey) {
    const assetPath = this.getPath(userId, assetKey);
    if (fs.existsSync(assetPath)) {
      return fs.remove(assetPath);
    }
  }

}

export default new FsCache();