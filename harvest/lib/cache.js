import fs from 'fs-extra';
import path from 'path';
import config from './config.js';
import logger from './logger.js';
import crypto from 'crypto';
import { reportFileWrite } from './reporting/index.js';

class FsCache {

  constructor() {
    this.rootDir = config.cache.rootDir;
    this.pgClient = null;
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

  async writeUserAsset(step, userId, assetKey, data) {
    const assetPath = this.getPath(userId, assetKey);
    return this.write(step, assetPath, data);
  }

  async write(step, assetPath, data) {
    await fs.ensureDir(path.dirname(assetPath));

    let parts = assetPath.split(path.sep);
    let userId = parts.find(p => p.match(/@/)) || '';

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

  async getFileStats(assetPath) {
    return {
      assetPath,
      hash: await this.hashFile(assetPath),
      lastModified: (await fs.stat(assetPath)).mtime.toISOString()
    }
  }

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

  async delete(userId, assetKey) {
    const assetPath = this.getPath(userId, assetKey);
    if (fs.existsSync(assetPath)) {
      return fs.remove(assetPath);
    }
  }

}

export default new FsCache();