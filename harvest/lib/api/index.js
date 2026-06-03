/**
 * Public facade for the API-shaped postgres projection used by the webapp
 * MIV and SiteFarm endpoints.
 *
 * Callers should import from here (not from miv.js / sitefarm.js / user.js
 * directly) so the internal module split can evolve without breaking imports.
 *
 *   import { loadMivPostgres, loadSitefarmPostgres,
 *            purgeMivPostgresExpert, purgeSitefarmPostgresExpert
 *          } from '../api/index.js';
 *
 * For tests or specialized callers, the builders/normalizers/upserts are
 * also re-exported.
 */

// Public entry points used by harvest/lib/load/index.js
export {
  loadMivPostgres,
  purgeMivPostgresExpert
} from './miv.js';

export {
  loadSitefarmPostgres,
  purgeSitefarmPostgresExpert
} from './sitefarm.js';

// Builders / normalizers / upserts — exported for tests + power users.
export {
  buildUserRecord,
  upsertUser,
  buildUserProfileRecord,
  upsertUserProfile,
  normalizeAeStdPersonDoc
} from './user.js';

export {
  buildGrantRecord,
  buildGrantRoles,
  normalizeAeStdGrantDoc,
  upsertGrant,
  replaceGrantRoles
} from './miv.js';

export {
  buildWorkRecord,
  buildWorkRoles,
  normalizeAeStdWorkDoc,
  upsertWork,
  replaceWorkRoles
} from './sitefarm.js';
