/**
 * Public surface of the grant-feed library — pure transform + delta + GCS
 * helpers. All filesystem / SFTP / orchestration logic lives in the CLI
 * wrappers under ../bin.
 */
export {
  buildAllRows,
  buildMetadataRows,
  buildLinkRows,
  buildPersonRows,
  rowsToCsv,
  cleanTitle,
  splitFullName,
  METADATA_HEADERS,
  LINK_HEADERS,
  PERSON_HEADERS,
  GRANT_IRI_PREFIX,
  SPONSOR_IRI_PREFIX,
  PURPOSE_TO_FUNDING_TYPE,
  LINK_ROLE_TO_TYPE_ID,
  PERSON_ROLES
} from './transform.js';

export { computeDelta, DELETE_LINK_HEADERS } from './delta.js';

export { parseGsUri, listGenerations, downloadGeneration } from './gcs.js';
