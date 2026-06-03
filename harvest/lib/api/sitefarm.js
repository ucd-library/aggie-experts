/**
 * SiteFarm postgres projection: works + author roles + expert profile.
 *
 * Source: ae-std/person.jsonld for the expert profile fields (handled by
 * ./user.js via buildUserProfileRecord/upsertUserProfile), and
 * ae-std/rel/{relationshipUri}.jsonld for each work the user authored.
 *
 * Target tables (all in the `api` schema):
 *   - "user"             (profile columns — managed via ./user.js)
 *   - "work"             (work master data)
 *   - work_type          (lookup, seeded by schema.sql, auto-grown if needed)
 *   - role_type          (lookup, shared with grants)
 *   - expert_work_role   (junction, with author_rank, is_favourite)
 *
 * Implementation notes on JSON-LD compaction:
 *   - publication fields use the csl:* vocabulary (NOT bibo/dcterms)
 *   - the @type list contains a schema.org type + ucdlib:Work; we surface only
 *     short forms in the API, and preserve the full URIs in `_typeUris` on the
 *     normalized doc for the work_type FK lookup
 *   - multi-vs-single value collapse follows ES JSON-LD framing: scalar if
 *     one, array if many. jsonldCollapse handles this.
 */

import { logger } from '@ucd-lib/experts-commons';
import PgClient from '../pg-client.js';
import {
  asArray,
  jsonldBool,
  jsonldFirstValue,
  jsonldCollapse,
  compactType,
  normalizeExpertId,
  getExpertIdFromRole,
  pickRoleType,
  partialDateToFull,
  readJson,
  stripAeBase,
  getApiSchemaName,
  assertSchemaName,
  URI
} from '../pg-jsonld.js';
import {
  buildUserProfileRecord,
  upsertUserProfile
} from './user.js';

// ----------------------------------------------------------------------------
// ae-std → webapp-shape work doc normalizer
// ----------------------------------------------------------------------------

/**
 * Resolve a single csl:author reference into the compact { @id, given, family,
 * rank } object that the ES sitefarm path returns. Returns null when the ref
 * doesn't point at a recognizable Author node.
 */
function resolveAuthorRef(ref, nodeMap) {
  const authorNode = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
    ? ref
    : nodeMap[ref?.['@id']];
  if (!authorNode) return null;

  const out = { '@id': authorNode['@id'] };

  const family = jsonldFirstValue(authorNode, URI.CSL_FAMILY);
  const given  = jsonldFirstValue(authorNode, URI.CSL_GIVEN);
  if (family != null) out.family = family;
  if (given  != null) out.given  = given;

  const rankRaw = jsonldFirstValue(authorNode, URI.RANK);
  const rankNum = Number(rankRaw);
  if (Number.isFinite(rankNum)) out.rank = rankNum;

  return out;
}

/**
 * Resolve a vivo:hasPublicationVenue reference to the compact {@id, issn, name}
 * shape ES emits. Returns null when the ref doesn't point at a venue node.
 */
function resolveVenueRef(ref, nodeMap) {
  const node = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
    ? ref
    : nodeMap[ref?.['@id']];
  if (!node) return null;

  const out = { '@id': stripAeBase(node['@id']) };
  const issn = jsonldFirstValue(node, URI.VIVO_ISSN);
  const name = jsonldFirstValue(node, URI.SCHEMA_NAME);
  if (issn) out.issn = issn;
  if (name) out.name = name;
  return out;
}

/**
 * Normalize an ae-std work relationship document (rel/*.jsonld). Returns the
 * compacted `{ '@graph': [workNode], _typeUris: [...] }` shape that
 * buildWorkRecord/buildWorkRoles understand.
 *
 * The ae-std rel doc is a JSON-LD array containing:
 *   - the publication node (csl:* bibliographic fields, csl:author refs, etc.)
 *   - one author node per author position (csl:family, csl:given, vivo:rank)
 *   - the Authorship relationship node (vivo:relates: [publicationUri, expertUri],
 *     schema:is-visible, schema:favourite, vivo:rank)
 */
export function normalizeAeStdWorkDoc(aeStdData) {
  if (!Array.isArray(aeStdData)) return aeStdData;

  const nodeMap = {};
  for (const node of aeStdData) {
    if (node?.['@id']) nodeMap[node['@id']] = node;
  }

  // Identify the publication node by its custom Work type. The work also
  // carries a schema.org type (Article/Book/Chapter/ConferencePaper/etc.),
  // but the ucdlib Work type is the stable hook.
  const workNode = aeStdData.find(n => asArray(n['@type']).includes(URI.WORK_TYPE));
  if (!workNode) return null;

  // relatedBy: pull each Authorship node. These may be inline objects on the
  // work node, or referenced by @id and stored as separate array entries.
  const relatedBy = asArray(workNode[URI.RELATED_BY]).map(ref => {
    const roleNode = (ref && Object.keys(ref).length > 1) ? ref : nodeMap[ref?.['@id']];
    if (!roleNode) return { '@id': ref?.['@id'] };

    const relates = asArray(roleNode[URI.RELATES])
      .map(r => stripAeBase(r?.['@id'] || r))
      .filter(Boolean);

    return {
      '@id': roleNode['@id'],
      '@type': asArray(roleNode['@type']).map(compactType),
      relates,
      'is-visible': jsonldBool(roleNode, URI.IS_VISIBLE, false),
      'ucdlib:favourite': jsonldBool(roleNode, URI.FAVOURITE, false),
      rank: Number(jsonldFirstValue(roleNode, URI.RANK)) || null
    };
  });

  // author: resolve each csl:author ref to the {given, family, rank} object
  // shape consumers expect. Sort by rank so positions are deterministic.
  const authors = asArray(workNode[URI.CSL_AUTHOR])
    .map(ref => resolveAuthorRef(ref, nodeMap))
    .filter(Boolean)
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

  // @type for raw_payload / API consumers: short forms only (matches ES).
  // We preserve the original full URIs as a sibling key `_typeUris` so the
  // upsertWork lookup can join against work_type.uri.
  const rawTypeUris = asArray(workNode['@type']).filter(t => typeof t === 'string');
  const shortTypes = Array.from(new Set(rawTypeUris.map(compactType).filter(Boolean)));

  // hasPublicationVenue: separate node referenced from the publication.
  const venueRef = asArray(workNode[URI.HAS_PUBLICATION_VENUE])[0];
  const venue = venueRef ? resolveVenueRef(venueRef, nodeMap) : null;

  return {
    '@graph': [{
      '@id':                workNode['@id'],
      '@type':              shortTypes,
      title:                jsonldFirstValue(workNode, URI.CSL_TITLE) ?? null,
      issued:               jsonldFirstValue(workNode, URI.CSL_ISSUED) ?? null,
      'container-title':    jsonldCollapse(workNode, URI.CSL_CONTAINER),
      volume:               jsonldFirstValue(workNode, URI.CSL_VOLUME) ?? null,
      page:                 jsonldFirstValue(workNode, URI.CSL_PAGE) ?? null,
      issue:                jsonldFirstValue(workNode, URI.CSL_ISSUE) ?? null,
      publisher:            jsonldFirstValue(workNode, URI.CSL_PUBLISHER) ?? null,
      DOI:                  jsonldFirstValue(workNode, URI.CSL_DOI) ?? null,
      abstract:             jsonldFirstValue(workNode, URI.CSL_ABSTRACT) ?? null,
      status:               jsonldFirstValue(workNode, URI.CSL_STATUS) ?? null,
      type:                 jsonldFirstValue(workNode, URI.CSL_TYPE) ?? null,
      // csl:date-available has no named term in the webapp JSON-LD context;
      // ES emits it under the prefixed name "cite:date-available".
      'cite:date-available': jsonldFirstValue(workNode, URI.CSL_DATE_AVAILABLE) ?? null,
      // Other csl:* fields ae-std may emit. jsonldCollapse handles scalar vs
      // array based on cardinality so we match ES's framed output.
      ISBN:                 jsonldCollapse(workNode, URI.CSL_ISBN),
      ISSN:                 jsonldCollapse(workNode, URI.CSL_ISSN),
      eissn:                jsonldCollapse(workNode, URI.CSL_EISSN),
      'collection-number':  jsonldCollapse(workNode, URI.CSL_COLLECTION_NUM),
      language:             jsonldCollapse(workNode, URI.CSL_LANGUAGE),
      license:              jsonldCollapse(workNode, URI.CSL_LICENSE),
      medium:               jsonldCollapse(workNode, URI.CSL_MEDIUM),
      note:                 jsonldCollapse(workNode, URI.CSL_NOTE),
      url:                  jsonldCollapse(workNode, URI.CSL_URL),
      hasPublicationVenue:  venue,
      author:               authors.length ? authors : null,
      relatedBy
    }],
    // Internal field — not part of the API response. buildWorkRecord pulls
    // this out for the work_type FK lookup so the API @type can stay short.
    _typeUris: rawTypeUris
  };
}

// ----------------------------------------------------------------------------
// Work builders (read a compacted/webapp-shape work doc)
// ----------------------------------------------------------------------------

// Identify the work node in a compacted webapp-shape doc. After
// normalizeAeStdWorkDoc runs, @type contains short forms — "Work" is always
// present (ae-std works.js emits ucdlib:Work alongside the schema.org type).
function getWorkNode(workDoc={}) {
  return asArray(workDoc['@graph']).find(node => {
    const types = asArray(node?.['@type']);
    return types.includes('Work') || types.includes(URI.WORK_TYPE);
  }) || null;
}

export function buildWorkRecord(workDoc={}) {
  const workNode = getWorkNode(workDoc);
  if (!workNode?.['@id']) return null;

  const issuedRaw = workNode.issued || null;

  // Prefer the normalizer-supplied _typeUris (full URIs) for the work_type
  // lookup; fall back to whatever's in @type if absent (e.g. an already-
  // webapp-shape doc that wasn't run through normalizeAeStdWorkDoc).
  const typeUris = asArray(workDoc._typeUris).filter(t => typeof t === 'string').length
    ? workDoc._typeUris
    : asArray(workNode['@type']).filter(t => typeof t === 'string');

  return {
    work_id:         workNode['@id'],
    title:           workNode.title || workNode.name || null,
    issued:          issuedRaw,
    issued_date:     partialDateToFull(issuedRaw),
    container_title: workNode['container-title'] || null,
    volume:          workNode.volume || null,
    page:            workNode.page || null,
    doi:             workNode.DOI || workNode.doi || null,
    abstract:        workNode.abstract || null,
    status:          workNode.status || null,
    raw_payload:     workNode,
    work_type_uris:  typeUris
  };
}

export function buildWorkRoles(workDoc={}) {
  const workNode = getWorkNode(workDoc);
  if (!workNode) return [];

  return asArray(workNode.relatedBy)
    .map(role => {
      const roleId = role?.['@id'];
      if (!roleId) return null;

      return {
        role_id:       roleId,
        work_id:       workNode['@id'],
        expert_id:     normalizeExpertId(getExpertIdFromRole(role)),
        role_type_uri: pickRoleType(role),
        is_visible:    role?.['is-visible'] === true,
        is_favourite:  role?.['ucdlib:favourite'] === true,
        author_rank:   Number.isInteger(role?.rank) ? role.rank : null,
        raw_payload:   role
      };
    })
    .filter(Boolean)
    .filter(role => role.work_id && role.role_id);
}

// ----------------------------------------------------------------------------
// Upserts
// ----------------------------------------------------------------------------

export async function upsertWork(client, schema, row) {
  // Seed any new work types we haven't seen before.
  for (const workTypeUri of row.work_type_uris) {
    if (workTypeUri) {
      await client.query(
        `INSERT INTO ${schema}.work_type (uri, label)
         VALUES ($1, $1)
         ON CONFLICT (uri) DO NOTHING`,
        [workTypeUri]
      );
    }
  }

  await client.query(
    `INSERT INTO ${schema}."work"
      (work_id, title, issued, issued_date, container_title, volume, page, doi,
       abstract, status, raw_payload, work_type_ids, last_seen_cdl)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       ARRAY(SELECT work_type_id FROM ${schema}.work_type WHERE uri = ANY($12::text[])),
       CURRENT_TIMESTAMP)
     ON CONFLICT (work_id)
     DO UPDATE SET
      title           = EXCLUDED.title,
      issued          = EXCLUDED.issued,
      issued_date     = EXCLUDED.issued_date,
      container_title = EXCLUDED.container_title,
      volume          = EXCLUDED.volume,
      page            = EXCLUDED.page,
      doi             = EXCLUDED.doi,
      abstract        = EXCLUDED.abstract,
      status          = EXCLUDED.status,
      raw_payload     = EXCLUDED.raw_payload,
      work_type_ids   = EXCLUDED.work_type_ids,
      last_seen_cdl   = CURRENT_TIMESTAMP`,
    [
      row.work_id,
      row.title,
      row.issued,
      row.issued_date,
      row.container_title,
      row.volume,
      row.page,
      row.doi,
      row.abstract,
      row.status,
      row.raw_payload,
      row.work_type_uris
    ]
  );
}

export async function replaceWorkRoles(client, schema, workId, roles) {
  await client.query(`DELETE FROM ${schema}.expert_work_role WHERE work_id = $1`, [workId]);

  for (const role of roles) {
    if (role.role_type_uri) {
      await client.query(
        `INSERT INTO ${schema}.role_type (uri, label)
         VALUES ($1, $1)
         ON CONFLICT (uri) DO NOTHING`,
        [role.role_type_uri]
      );
    }
  }

  for (const role of roles) {
    await client.query(
      `INSERT INTO ${schema}.expert_work_role
        (role_id, work_id, expert_id, role_type_id, is_visible, is_favourite,
         author_rank, raw_payload, last_seen_cdl)
       VALUES ($1, $2, $3,
         (SELECT role_type_id FROM ${schema}.role_type WHERE uri = $4),
         $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (role_id)
       DO UPDATE SET
        work_id       = EXCLUDED.work_id,
        expert_id     = EXCLUDED.expert_id,
        role_type_id  = EXCLUDED.role_type_id,
        is_visible    = EXCLUDED.is_visible,
        is_favourite  = EXCLUDED.is_favourite,
        author_rank   = EXCLUDED.author_rank,
        raw_payload   = EXCLUDED.raw_payload,
        last_seen_cdl = CURRENT_TIMESTAMP`,
      [
        role.role_id,
        role.work_id,
        role.expert_id,
        role.role_type_uri,
        role.is_visible,
        role.is_favourite,
        role.author_rank,
        role.raw_payload
      ]
    );
  }
}

// ----------------------------------------------------------------------------
// Public entry points
// ----------------------------------------------------------------------------

/**
 * Load the sitefarm projection (expert profile + works) into postgres for a
 * single user. Mirrors loadMivPostgres but reads expert fields from
 * ae-std/person.jsonld and walks the work files passed in.
 *
 * Expects `files` to contain a `personAeStd` entry (path to ae-std/person.jsonld)
 * and zero or more `work` entries (paths to ae-std/rel/{relationshipUri}.jsonld).
 */
export async function loadSitefarmPostgres({ user, metadata={}, files=[] }) {
  const schema = getApiSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient();
  const personFile = files.find(file => file.type === 'personAeStd');
  const workFiles  = files.filter(file => file.type === 'work');

  // The "user" row is upserted by loadMivPostgres before we run; we just
  // overlay profile fields here. If the row doesn't exist yet, the UPDATE is
  // a no-op and we'll catch the user on the next pass.
  let userProfileRecord = null;
  if (personFile?.path) {
    const personDoc = await readJson(personFile.path);
    userProfileRecord = buildUserProfileRecord({ metadata, aeStdPersonDoc: personDoc });
  }

  if (!userProfileRecord?.expert_id) {
    logger.warn({ user }, 'Sitefarm postgres load: missing ae-std person doc or expert_id; skipping profile update');
  }

  try {
    await pgClient.query('BEGIN');

    if (userProfileRecord?.expert_id) {
      await upsertUserProfile(pgClient, schema, userProfileRecord);
    }

    for (const file of workFiles) {
      let workDoc = await readJson(file.path);
      if (!workDoc) continue;

      // ae-std rel files are JSON arrays; normalize first.
      if (Array.isArray(workDoc)) {
        workDoc = normalizeAeStdWorkDoc(workDoc);
        if (!workDoc) continue;
      }

      const workRecord = buildWorkRecord(workDoc);
      if (!workRecord?.work_id) continue;

      await upsertWork(pgClient, schema, workRecord);
      await replaceWorkRoles(pgClient, schema, workRecord.work_id, buildWorkRoles(workDoc));
    }

    await pgClient.query('COMMIT');
    logger.info({ user, workCount: workFiles.length }, 'Sitefarm postgres load completed');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    await pgClient.end();
  }
}

export async function purgeSitefarmPostgresExpert(expertId) {
  if (!expertId) return;

  const schema = getApiSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient();
  const normalizedExpertId = normalizeExpertId(expertId);
  if (!normalizedExpertId) return;

  try {
    await pgClient.query('BEGIN');

    // Remove this expert's roles, then orphaned works.
    await pgClient.query(
      `DELETE FROM ${schema}.expert_work_role WHERE expert_id = $1`,
      [normalizedExpertId]
    );
    await pgClient.query(
      `DELETE FROM ${schema}."work" w
       WHERE NOT EXISTS (
         SELECT 1 FROM ${schema}.expert_work_role wr WHERE wr.work_id = w.work_id
       )`
    );

    // Clear the sitefarm-specific profile columns. Identity columns are
    // managed by purgeMivPostgresExpert.
    await pgClient.query(
      `UPDATE ${schema}."user"
         SET orcid_id           = NULL,
             researcher_id      = NULL,
             scopus_ids         = NULL,
             overview           = NULL,
             research_interests = NULL,
             contact_info       = NULL,
             expert_raw_payload = NULL,
             last_seen_cdl      = CURRENT_TIMESTAMP
       WHERE expert_id = $1`,
      [normalizedExpertId]
    );

    await pgClient.query('COMMIT');
    logger.info({ expertId }, 'Sitefarm postgres expert purge completed');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    await pgClient.end();
  }
}
