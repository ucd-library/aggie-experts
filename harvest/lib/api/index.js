/**
 * Public facade for the API-shaped postgres projection used by the webapp
 * MIV and SiteFarm endpoints.
 *
 * Each underlying module is a single class with a default export. The facade
 * re-exports them under named imports so callers don't need to learn the
 * internal module layout:
 *
 *   import { MivApi, SitefarmApi } from '../api/index.js';
 *
 *   const miv      = new MivApi();
 *   const sitefarm = new SitefarmApi();
 *
 *   await miv.load({ user, metadata, files });
 *   await sitefarm.load({ user, metadata, files });
 *   await miv.purge(expertId);
 *   await sitefarm.purge(expertId);
 *
 * ApiUser is re-exported for callers that need to write to the user table
 * outside the MIV/SiteFarm load paths (e.g. one-off CLIs or tests).
 */

export { default as MivApi } from './miv.js';
export { default as SitefarmApi } from './sitefarm.js';
export { default as ApiUser } from './user.js';
