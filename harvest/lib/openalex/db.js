import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { SCHEMA } from './schema.js';

function openDb(dbPath) {
  fs.ensureDirSync(path.dirname(path.resolve(dbPath)));
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export { openDb };
