/**
 * @module cache-paths
 * @description Single source of truth for the CaskFS asset keys used across the
 * harvest ETL. Historically these keys were built ad-hoc at every call site —
 * some honoring `config.cache.*`, some hardcoding the string, and some as arrays
 * vs joined strings — which let writers and readers of the same asset drift apart
 * (e.g. a writer honoring `EXPERTS_AE_STD_FORMAT_CACHE_DIR` while the matching
 * reader hardcoded 'ae-std/...').
 *
 * These are PURE builders: they derive from `config.cache.*` wherever a
 * configurable directory exists and take NO dependency on the cache singleton
 * (`./cache.js`), so they are trivially unit-testable and safe to import from
 * anywhere — including cache.js itself, without a circular import.
 *
 * Keys are returned as arrays of path segments. Every cache method that takes an
 * asset key (`getUserPath`, `writeUserAsset`, `existsUserAsset`,
 * `getScholarlyWorkPath`, ...) accepts an array and `path.join`s it internally,
 * so returning arrays keeps these builders agnostic of the platform separator.
 */
import { config } from '@ucd-lib/experts-commons';

// Directory segments that have no `config.cache.*` entry today. Kept here so the
// literal still lives in exactly one place; promote to config if it ever needs
// to be environment-configurable.
const WEBAPP_DIR = 'webapp';

// ---- ae-std (config.cache.aeStdFormatDir) -----------------------------------

/**
 * Directory key for a user's ae-std transformed output tree.
 * @returns {String} e.g. 'ae-std'
 */
export function aeStdDirKey() {
  return config.cache.aeStdFormatDir;
}

/**
 * Asset key for a user's ae-std person (identity) document.
 * @returns {String[]} e.g. ['ae-std', 'person.jsonld']
 */
export function aeStdPersonKey() {
  return [config.cache.aeStdFormatDir, 'person.jsonld'];
}

/**
 * Asset key for a single ae-std relationship document.
 * @param {String} relationshipUri the relationship URI, used as the filename
 * @returns {String[]} e.g. ['ae-std', 'rel', '<relationshipUri>.jsonld']
 */
export function aeStdRelKey(relationshipUri) {
  return [config.cache.aeStdFormatDir, 'rel', `${relationshipUri}.jsonld`];
}

// ---- ae-webapp scholarly works (config.cache.aeWebappDir) -------------------

/**
 * Asset key (relative to a scholarly-work type root) for a webapp scholarly
 * work document. Combine with `cache.getScholarlyWorkPath(type, key)`.
 * @param {String} uri the work/grant subject URI, used as the filename
 * @returns {String[]} e.g. ['ae-webapp', '<uri>.json']
 */
export function aeWebappWorkKey(uri) {
  return [config.cache.aeWebappDir, `${uri}.json`];
}

// ---- webapp expert projections (no config dir) ------------------------------

/**
 * Asset key for a user's assembled webapp expert document (the elasticsearch
 * projection source).
 * @returns {String[]} e.g. ['webapp', 'expert.jsonld']
 */
export function webappExpertKey() {
  return [WEBAPP_DIR, 'expert.jsonld'];
}

/**
 * Asset key for a user's framed base webapp expert document.
 * @returns {String[]} e.g. ['webapp', 'expert-base.jsonld']
 */
export function webappExpertBaseKey() {
  return [WEBAPP_DIR, 'expert-base.jsonld'];
}

/**
 * Asset key for a user's simplified webapp expert document.
 * @returns {String[]} e.g. ['webapp', 'expert-simplified.jsonld']
 */
export function webappExpertSimplifiedKey() {
  return [WEBAPP_DIR, 'expert-simplified.jsonld'];
}

// ---- per-user top-level markers (no config dir) -----------------------------

/**
 * Asset key for a user's harvest metadata document.
 * @returns {String} 'metadata.json'
 */
export function metadataKey() {
  return 'metadata.json';
}

/**
 * Asset key for the marker file that flags a user as non-public.
 * @returns {String} 'PRIVATE'
 */
export function privateMarkerKey() {
  return 'PRIVATE';
}

// ---- group user lists (root cache path) -------------------------------------

/**
 * Filename for a CDL group's cached user list. This is NOT a per-user asset key —
 * callers join it with `cache.getPath()` to place it at the week/root level.
 * @param {String} group group id or name
 * @returns {String} e.g. 'users-list-experts.json'
 */
export function usersListFilename(group) {
  return `users-list-${group}.json`;
}
