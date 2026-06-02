import cache from '../cache.js';
import { config, logger } from '@ucd-lib/experts-commons';
import { Temporal } from '@js-temporal/polyfill';
import { getYearWeek } from '@ucd-lib/experts-commons';
import PgClient from '../pg-client.js';

const WEEK_YEAR_START = 2026;
const WEEK_YEAR_END = WEEK_YEAR_START + 20;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// function reportFileWrite(opts={}) {
//   if( !config?.reporting?.enabled ) {
//     return;
//   }
//   opts.command_id = config.reporting.commandId;
//   return config.postgres.client.insertFileCacheOp(opts);
// }

async function initYearWeek(pgClient) {
  let weekYearInfo = getYearWeek({allValues: true});
  let date = new Temporal.PlainDate(WEEK_YEAR_START, 1, 1);
  let endDate = new Temporal.PlainDate(WEEK_YEAR_END+1, 1, 1);

  while( Temporal.PlainDate.compare(date, endDate) < 0 ) {
    weekYearInfo = getYearWeek({date, allValues: true, asString: true});
    await pgClient.insertYearWeek(
      weekYearInfo.yearWeek,
      weekYearInfo.weekStart,
      weekYearInfo.weekEnd
    );
    date = date.add({ days: 7 });
  }
}

function captureError(error) {  
  return config.postgres.client.insertError({
    message : error.message,
    stack : error.stack,
    command_id : config.reporting.commandId
  });
}

function updateEsIndex(alias, indexName, docCount) {
  return config.postgres.client.updateEsIndex(alias, indexName, docCount);
}

function toBool(value, defaultValue=false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const v = String(value).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function hasType(node, type) {
  return asArray(node?.['@type']).includes(type);
}

function toShortType(type) {
  if (typeof type !== 'string') return type;
  if (type.includes('#')) return type.split('#').pop();
  if (type.includes('/')) return type.split('/').pop();
  return type;
}

function toShortPrecision(precision) {
  if (typeof precision !== 'string') return precision;
  if (precision.startsWith('http://vivoweb.org/ontology/core#')) return 'vivo:' + precision.split('#').pop();
  return precision;
}

function normalizeExpertId(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('expert/')) {
    return trimmed.slice('expert/'.length);
  }

  if (trimmed.startsWith('http://experts.ucdavis.edu/expert/')) {
    return trimmed.slice('http://experts.ucdavis.edu/expert/'.length);
  }

  if (trimmed.startsWith('info:fedora/expert/')) {
    return trimmed.slice('info:fedora/expert/'.length);
  }

  return trimmed;
}

// Schema for the API-shaped projection consumed by the webapp MIV and
// sitefarm endpoints. Holds "user", role_type, grant/grant_type/expert_grant_role,
// and work/work_type/expert_work_role. Distinct from etl_reporting (which
// continues to hold ETL observability tables: command, error, year_week, etc.)
// and is wrapped by PgClient.
function getSchemaName() {
  return 'api';
}

function assertSchemaName(schema) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid postgres schema name: ${schema}`);
  }
}

function getExpertIdFromRole(role={}) {
  if (typeof role.inheres_in === 'string' && role.inheres_in.startsWith('expert/')) {
    return role.inheres_in;
  }

  for (const rel of asArray(role.relates)) {
    if (typeof rel === 'string' && rel.startsWith('expert/')) {
      return rel;
    }
  }

  return null;
}

function pickRoleType(role={}) {
  const types = asArray(role['@type']);
  return types[0] || null;
}

function toDateOrNull(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toNumberOrNull(value) {
  if (value === undefined || value === null) return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function trimGrantTitle(title='') {
  if (typeof title !== 'string') return null;
  return title.split('§')[0].trim() || null;
}

async function readJson(path) {
  if (!path || !await cache.exists(path)) {
    return null;
  }

  return JSON.parse(await cache.read(path));
}

function getExpertNode(expertDoc={}) {
  return asArray(expertDoc['@graph']).find(node => hasType(node, 'Expert')) || null;
}

function getGrantNode(grantDoc={}) {
  return asArray(grantDoc['@graph']).find(node => hasType(node, 'Grant')) || null;
}

function buildUserRecord({ user, metadata={}, expertDoc={} }) {
  const expertNode = getExpertNode(expertDoc) || {};
  const expertId = normalizeExpertId(metadata.expertId || expertDoc['@id']);
  const email = expertNode?.contactInfo?.hasEmail || expertNode?.hasEmail || user || null;

  if (!expertId || !email) {
    return null;
  }

  return {
    email,
    expert_id: expertId,
    ucd_person_uuid: metadata?.ucdPersonUUID || null,
    iam_id: metadata?.iamId || null,
    display_name: expertNode?.name || expertNode?.contactInfo?.name || null
  };
}

function buildGrantRecord(grantDoc={}) {
  const grantNode = getGrantNode(grantDoc);
  if (!grantNode?.['@id']) return null;

  return {
    grant_id: grantNode['@id'],
    title: trimGrantTitle(grantNode.name) || grantNode.name || grantNode.title || null,
    sponsor_id: grantNode.sponsorAwardId || null,
    sponsor_name: grantNode?.assignedBy?.name || null,
    total_award_amount: toNumberOrNull(grantNode.totalAwardAmount),
    start_date: toDateOrNull(grantNode?.dateTimeInterval?.start?.dateTime),
    end_date: toDateOrNull(grantNode?.dateTimeInterval?.end?.dateTime),
    status: grantNode.status || null,
    raw_payload: grantNode,
    grant_type_uris: asArray(grantNode['@type']).filter(t => typeof t === 'string')
  };
}

function buildGrantRoles(grantDoc={}) {
  const grantNode = getGrantNode(grantDoc);
  if (!grantNode) return [];

  return asArray(grantNode.relatedBy)
    .map(role => {
      const roleId = role?.['@id'];
      if (!roleId) return null;

      return {
        role_id: roleId,
        grant_id: grantNode['@id'],
        expert_id: normalizeExpertId(getExpertIdFromRole(role)),
        role_type_uri: pickRoleType(role),
        is_visible: role?.['is-visible'] === true
      };
    })
    .filter(Boolean)
    .filter(role => role.grant_id && role.role_type_uri);
}

async function upsertUser(client, schema, row) {
  await client.query(
    `INSERT INTO ${schema}."user"
      (email, expert_id, ucd_person_uuid, iam_id, display_name, last_seen_cdl)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (email)
     DO UPDATE SET
      expert_id = EXCLUDED.expert_id,
      ucd_person_uuid = EXCLUDED.ucd_person_uuid,
      iam_id = EXCLUDED.iam_id,
      display_name = EXCLUDED.display_name,
      last_seen_cdl = CURRENT_TIMESTAMP`,
    [row.email, row.expert_id, row.ucd_person_uuid, row.iam_id, row.display_name]
  );
}

async function upsertGrant(client, schema, row) {
  for (const grantTypeUri of row.grant_type_uris) {
    if (grantTypeUri) {
      await client.query(
        `INSERT INTO ${schema}.grant_type (uri, label)
         VALUES ($1, $1)
         ON CONFLICT (uri) DO NOTHING`,
        [grantTypeUri]
      );
    }
  }

  await client.query(
    `INSERT INTO ${schema}."grant"
      (grant_id, title, sponsor_id, sponsor_name, total_award_amount, start_date, end_date, status, raw_payload, grant_type_ids, last_seen_cdl)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
       ARRAY(SELECT grant_type_id FROM ${schema}.grant_type WHERE uri = ANY($10::text[])),
       CURRENT_TIMESTAMP)
     ON CONFLICT (grant_id)
     DO UPDATE SET
      title = EXCLUDED.title,
      sponsor_id = EXCLUDED.sponsor_id,
      sponsor_name = EXCLUDED.sponsor_name,
      total_award_amount = EXCLUDED.total_award_amount,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      status = EXCLUDED.status,
      raw_payload = EXCLUDED.raw_payload,
      grant_type_ids = EXCLUDED.grant_type_ids,
      last_seen_cdl = CURRENT_TIMESTAMP`,
    [
      row.grant_id,
      row.title,
      row.sponsor_id,
      row.sponsor_name,
      row.total_award_amount,
      row.start_date,
      row.end_date,
      row.status,
      row.raw_payload,
      row.grant_type_uris
    ]
  );
}

async function replaceGrantRoles(client, schema, grantId, roles, expertId) {
  // Delete this expert's roles and any orphaned rows with no expert linkage (NULL
  // expert_id), which come from old-style harvests before proper inheres_in mapping.
  await client.query(
    `DELETE FROM ${schema}.expert_grant_role WHERE grant_id = $1 AND (expert_id = $2 OR expert_id IS NULL)`,
    [grantId, expertId]
  );

  // ensure all role types exist in the role_type table
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

  // insert expert_grant_roles
  for (const role of roles) {
    await client.query(
      `INSERT INTO ${schema}.expert_grant_role
        (role_id, grant_id, expert_id, role_type_id, is_visible, last_seen_cdl)
       VALUES ($1, $2, $3, (SELECT role_type_id FROM ${schema}.role_type WHERE uri = $4), $5, CURRENT_TIMESTAMP)
       ON CONFLICT (role_id)
       DO UPDATE SET
        grant_id = EXCLUDED.grant_id,
        expert_id = EXCLUDED.expert_id,
        role_type_id = EXCLUDED.role_type_id,
        is_visible = EXCLUDED.is_visible,
        last_seen_cdl = CURRENT_TIMESTAMP`,
      [
        role.role_id,
        role.grant_id,
        role.expert_id,
        role.role_type_uri,
        role.is_visible
      ]
    );
  }
}

/**
 * @function normalizeAeStdGrantDoc
 * @description Converts an ae-std expanded JSON-LD array (from ae-std/rel/*.jsonld) into
 * the compacted `{ '@graph': [grantNode] }` shape that buildGrantRecord / buildGrantRoles
 * expect, resolving all internal $id references along the way.
 *
 * If the input is already an object (e.g. a webapp-format grant doc from a regenerated
 * disassociated work), it is returned unchanged so the caller can handle both formats.
 */
function normalizeAeStdGrantDoc(aeStdData) {
  if( !Array.isArray(aeStdData) ) return aeStdData;

  // lookup map for resolving @id references
  const nodeMap = {};
  for( const node of aeStdData ) {
    if( node?.['@id'] ) nodeMap[node['@id']] = node;
  }

  // get grant node
  const GRANT_URI = 'http://vivoweb.org/ontology/core#Grant';
  const grantNode = aeStdData.find(n =>
    asArray(n['@type']).includes(GRANT_URI)
  );
  if( !grantNode ) return null;

  const getFirstValue = (node, uri) => {
    const first = asArray(node?.[uri])[0];
    return first?.['@value'] ?? first?.['@id'] ?? undefined;
  };

  // get assignedBy (funder node)
  const assignedById = asArray(grantNode['http://vivoweb.org/ontology/core#assignedBy'])[0]?.['@id'];
  const assignedByNode = assignedById ? nodeMap[assignedById] : null;
  const assignedBy = assignedByNode
    ? {
        '@id': assignedByNode['@id'],
        '@type': toShortType(asArray(assignedByNode['@type'])[0]),
        name: getFirstValue(assignedByNode, 'http://schema.org/name')
      }
    : undefined;

  // get dateTimeInterval -> start / end date nodes
  const intervalId = asArray(grantNode['http://vivoweb.org/ontology/core#dateTimeInterval'])[0]?.['@id'];
  const intervalNode = intervalId ? nodeMap[intervalId] : null;
  let dateTimeInterval;
  if( intervalNode ) {
    const startId = asArray(intervalNode['http://vivoweb.org/ontology/core#start'])[0]?.['@id'];
    const endId   = asArray(intervalNode['http://vivoweb.org/ontology/core#end'])[0]?.['@id'];
    const startNode = startId ? nodeMap[startId] : null;
    const endNode   = endId   ? nodeMap[endId]   : null;
    dateTimeInterval = {
      '@id': intervalNode['@id'],
      start: startNode ? {
        '@id': startNode['@id'],
        dateTime: getFirstValue(startNode, 'http://vivoweb.org/ontology/core#dateTime'),
        dateTimePrecision: toShortPrecision(getFirstValue(startNode, 'http://vivoweb.org/ontology/core#dateTimePrecision'))
      } : undefined,
      end: endNode ? {
        '@id': endNode['@id'],
        dateTime: getFirstValue(endNode, 'http://vivoweb.org/ontology/core#dateTime'),
        dateTimePrecision: toShortPrecision(getFirstValue(endNode, 'http://vivoweb.org/ontology/core#dateTimePrecision'))
      } : undefined
    };
  }

  // get relatedBy role refs (some may be inline objects, some just { @id } refs)
  const BASE_URL = 'http://experts.ucdavis.edu/';
  const stripBase = id => (typeof id === 'string' && id.startsWith(BASE_URL)) ? id.slice(BASE_URL.length) : id;

  const relatedBy = asArray(grantNode['http://vivoweb.org/ontology/core#relatedBy']).map(ref => {
    // inline role objects have keys beyond just @id; pure refs have only @id
    const roleNode = (Object.keys(ref).length > 1) ? ref : nodeMap[ref['@id']];
    if( !roleNode ) return { '@id': ref['@id'] };

    const roleName = getFirstValue(roleNode, 'http://schema.org/name');

    const inheresInId = asArray(roleNode['http://purl.obolibrary.org/obo/RO_0000052'])[0]?.['@id'];
    const inheresIn = inheresInId ? stripBase(inheresInId) : undefined;

    const relates = asArray(roleNode['http://vivoweb.org/ontology/core#relates'])
      .map(r => stripBase(r['@id'] || r))
      .filter(Boolean);

    const isVisibleRaw = asArray(roleNode['http://schema.library.ucdavis.edu/schema#is-visible'])[0]?.['@value'];
    const isVisible = isVisibleRaw === 'true' || isVisibleRaw === true;

    return {
      '@id': roleNode['@id'],
      '@type': asArray(roleNode['@type']).map(toShortType),
      name: roleName,
      inheres_in: inheresIn,
      relates,
      'is-visible': isVisible
    };
  });

  const rawIdentifiers = asArray(grantNode['http://schema.org/identifier']);
  const identifier = Array.from(new Set(rawIdentifiers
    .map(item => item?.['@id'] ?? item?.['@value'] ?? item)
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim())));

  const rawTypes = asArray(grantNode['@type']);
  const shortTypes = rawTypes.map(toShortType);
  const normalizedTypes = Array.from(new Set(shortTypes.filter(Boolean))).sort((a, b) => {
    if (a === 'Grant') return 1;
    if (b === 'Grant') return -1;
    return 0;
  });

  return {
    '@graph': [{
      '@id':              grantNode['@id'],
      '@type':            normalizedTypes,
      identifier,
      name:               getFirstValue(grantNode, 'http://schema.org/name'),
      sponsorAwardId:     getFirstValue(grantNode, 'http://vivoweb.org/ontology/core#sponsorAwardId'),
      totalAwardAmount:   getFirstValue(grantNode, 'http://vivoweb.org/ontology/core#totalAwardAmount'),
      status:             getFirstValue(grantNode, 'http://citationstyles.org/schema/status'),
      assignedBy,
      dateTimeInterval,
      relatedBy
    }]
  };
}

async function loadMivPostgres({ user, metadata={}, files=[] }) {
  const schema = getSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient();
  const expertFile = files.find(file => file.type === 'expert');
  const grantFiles = files.filter(file => file.type === 'grant');

  const expertDoc = await readJson(expertFile?.path);
  const userRecord = buildUserRecord({ user, metadata, expertDoc });

  if (!userRecord?.expert_id || !userRecord?.email) {
    logger.warn({ user }, 'MIV postgres load skipped - missing user/expert identity');
    await pgClient.end();
    return;
  }

  try {
    await pgClient.query('BEGIN');

    await upsertUser(pgClient, schema, userRecord);

    for (const file of grantFiles) {
      let grantDoc = await readJson(file.path);
      if (!grantDoc) continue;

      // ae-std files are JSON arrays; normalize to the compacted shape buildGrantRecord expects
      if (Array.isArray(grantDoc)) {
        grantDoc = normalizeAeStdGrantDoc(grantDoc);
        if (!grantDoc) continue;
      }

      const grantRecord = buildGrantRecord(grantDoc);
      if (!grantRecord?.grant_id) continue;

      await upsertGrant(pgClient, schema, grantRecord);
      await replaceGrantRoles(pgClient, schema, grantRecord.grant_id, buildGrantRoles(grantDoc), userRecord.expert_id);
    }

    await pgClient.query('COMMIT');
    logger.info({ user, grantCount: grantFiles.length }, 'MIV postgres load completed');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    await pgClient.end();
  }
}

// ============================================================================
// Sitefarm postgres projection: works + expert profile fields
// ----------------------------------------------------------------------------
// The sitefarm API serves an expert's modified-date, profile fields (orcid,
// scopus, researcher, overview, research interests), contact info (preferred
// block + websites list), and up to 5 most-recent works per expert.
//
// All of this is loaded from ae-std documents to keep the API decoupled from
// elasticsearch:
//   - expert profile fields  ← ae-std/person.jsonld
//   - work nodes + roles     ← ae-std/rel/{relationshipUri}.jsonld
// ============================================================================

// Common JSON-LD URI constants used by the ae-std normalizers. The publication
// nodes emitted by harvest/lib/transform/ae-std/works.js use the citation-style
// (csl) vocabulary — NOT bibo or dcterms — for almost every bibliographic
// field. Mirror that here so the normalizer extracts everything cleanly.
const URI = {
  // Schema / aggie-experts custom
  EXPERT_TYPE:        'http://schema.library.ucdavis.edu/schema#Expert',
  WORK_TYPE:          'http://schema.library.ucdavis.edu/schema#Work',
  IS_VISIBLE:         'http://schema.library.ucdavis.edu/schema#is-visible',
  IS_PREFERRED:       'http://schema.library.ucdavis.edu/schema#isPreferred',
  RESEARCH_INTERESTS: 'http://schema.library.ucdavis.edu/schema#researchInterests',
  FAVOURITE:          'http://schema.library.ucdavis.edu/schema#favourite',
  // VIVO
  ORCID:              'http://vivoweb.org/ontology/core#orcidId',
  SCOPUS:             'http://vivoweb.org/ontology/core#scopusId',
  RESEARCHER:         'http://vivoweb.org/ontology/core#researcherId',
  OVERVIEW:           'http://vivoweb.org/ontology/core#overview',
  RANK:               'http://vivoweb.org/ontology/core#rank',
  RELATES:            'http://vivoweb.org/ontology/core#relates',
  RELATED_BY:         'http://vivoweb.org/ontology/core#relatedBy',
  // Citation Styles vocabulary (csl) — used for publication bibliographic fields
  CSL_TITLE:          'http://citationstyles.org/schema/title',
  CSL_ABSTRACT:       'http://citationstyles.org/schema/abstract',
  CSL_DOI:            'http://citationstyles.org/schema/DOI',
  CSL_VOLUME:         'http://citationstyles.org/schema/volume',
  CSL_PAGE:           'http://citationstyles.org/schema/page',
  CSL_ISSUE:          'http://citationstyles.org/schema/issue',
  CSL_CONTAINER:      'http://citationstyles.org/schema/container-title',
  CSL_PUBLISHER:      'http://citationstyles.org/schema/publisher',
  CSL_STATUS:         'http://citationstyles.org/schema/status',
  CSL_ISSUED:         'http://citationstyles.org/schema/issued',
  CSL_AUTHOR:         'http://citationstyles.org/schema/author',
  CSL_FAMILY:         'http://citationstyles.org/schema/family',
  CSL_GIVEN:          'http://citationstyles.org/schema/given',
  CSL_TYPE:           'http://citationstyles.org/schema/type',
  CSL_DATE_AVAILABLE: 'http://citationstyles.org/schema/date-available',
  CSL_ISBN:           'http://citationstyles.org/schema/ISBN',
  CSL_ISSN:           'http://citationstyles.org/schema/ISSN',
  CSL_EISSN:          'http://citationstyles.org/schema/eissn',
  CSL_COLLECTION_NUM: 'http://citationstyles.org/schema/collection-number',
  CSL_LANGUAGE:       'http://citationstyles.org/schema/language',
  CSL_LICENSE:        'http://citationstyles.org/schema/license',
  CSL_MEDIUM:         'http://citationstyles.org/schema/medium',
  CSL_NOTE:           'http://citationstyles.org/schema/note',
  CSL_URL:            'http://citationstyles.org/schema/url',
  // Publication venue (vivo)
  HAS_PUBLICATION_VENUE: 'http://vivoweb.org/ontology/core#hasPublicationVenue',
  VIVO_ISSN:             'http://vivoweb.org/ontology/core#issn',
  // schema.org / dcterms (still used for the Expert side)
  SCHEMA_NAME:        'http://schema.org/name',
  SCHEMA_IDENTIFIER:  'http://schema.org/identifier',
  // VCard
  VCARD_INDIVIDUAL:   'http://www.w3.org/2006/vcard/ns#Individual',
  VCARD_NAME_TYPE:    'http://www.w3.org/2006/vcard/ns#Name',
  VCARD_URL_TYPE:     'http://www.w3.org/2006/vcard/ns#URL',
  VCARD_ORG_TYPE:     'http://www.w3.org/2006/vcard/ns#Organization',
  VCARD_TITLE_TYPE:   'http://www.w3.org/2006/vcard/ns#Title',
  VCARD_HAS_URL:      'http://www.w3.org/2006/vcard/ns#hasURL',
  VCARD_URL:          'http://www.w3.org/2006/vcard/ns#url',
  VCARD_HAS_EMAIL:    'http://www.w3.org/2006/vcard/ns#hasEmail',
  VCARD_HAS_NAME:     'http://www.w3.org/2006/vcard/ns#hasName',
  VCARD_HAS_ORG:      'http://www.w3.org/2006/vcard/ns#hasOrganizationalUnit',
  VCARD_HAS_TITLE:    'http://www.w3.org/2006/vcard/ns#hasTitle',
  VCARD_FAMILY_NAME:  'http://www.w3.org/2006/vcard/ns#familyName',
  VCARD_GIVEN_NAME:   'http://www.w3.org/2006/vcard/ns#givenName',
  VCARD_MIDDLE_NAME:  'http://www.w3.org/2006/vcard/ns#middleName',
  VCARD_PRONOUNS:     'http://www.w3.org/2006/vcard/ns#pronouns',
  VCARD_TITLE:        'http://www.w3.org/2006/vcard/ns#title'
};

// Base URL that ae-std uses for expert/ relative IDs. The ES sitefarm path
// returns these as short forms (e.g. "expert/abc123#vcard-oap-1-web-0"); we
// need to do the same for parity.
const AE_BASE_URL = 'http://experts.ucdavis.edu/';

function stripAeBase(id) {
  return (typeof id === 'string' && id.startsWith(AE_BASE_URL))
    ? id.slice(AE_BASE_URL.length)
    : id;
}

// JSON-LD context-driven type compaction is non-uniform in the ES sitefarm
// output: types with named terms in the webapp context collapse to bare names
// (Work, Authorship, Name, URL, Title, ScholarlyArticle, ...), but unmapped
// types keep their namespace prefix (vcard:Organization, ucdlib:Authorship,
// vcard:Individual). Hardcode the mapping to match what ES emits, since we're
// not running the JSON-LD framing machinery ourselves.
const TYPE_COMPACTION = {
  // Vcard types
  'http://www.w3.org/2006/vcard/ns#Name':           'Name',
  'http://www.w3.org/2006/vcard/ns#URL':            'URL',
  'http://www.w3.org/2006/vcard/ns#Title':          'Title',
  'http://www.w3.org/2006/vcard/ns#Organization':   'vcard:Organization',
  'http://www.w3.org/2006/vcard/ns#Individual':     'vcard:Individual',
  // Work / publication types
  'http://schema.library.ucdavis.edu/schema#Work':       'Work',
  'http://schema.library.ucdavis.edu/schema#Authorship': 'ucdlib:Authorship',
  'http://vivoweb.org/ontology/core#Authorship':         'Authorship',
  'http://vivoweb.org/ontology/core#ConferencePaper':    'ConferencePaper',
  'http://schema.org/Book':                              'Book',
  'http://schema.org/Chapter':                           'Chapter',
  'http://schema.org/ScholarlyArticle':                  'ScholarlyArticle',
  // Grant types
  'http://schema.library.ucdavis.edu/schema#GrantRole':                'GrantRole',
  'http://vivoweb.org/ontology/core#PrincipalInvestigatorRole':        'PrincipalInvestigatorRole',
  'http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole':      'CoPrincipalInvestigatorRole',
  'http://vivoweb.org/ontology/core#ResearcherRole':                   'ResearcherRole',
  'http://vivoweb.org/ontology/core#LeaderRole':                       'LeaderRole'
};
function compactType(t) {
  if (typeof t !== 'string') return t;
  return TYPE_COMPACTION[t] || toShortType(t);
}
// Backwards-compat shim — old name still used in a couple of places.
const compactVcardType = compactType;

function jsonldFirstValue(node, uri) {
  const first = asArray(node?.[uri])[0];
  if (first === undefined || first === null) return undefined;
  return first['@value'] ?? first['@id'] ?? undefined;
}

function jsonldAllValues(node, uri) {
  return asArray(node?.[uri])
    .map(v => (v && typeof v === 'object') ? (v['@value'] ?? v['@id']) : v)
    .filter(v => v !== undefined && v !== null);
}

function jsonldBool(node, uri, defaultValue=false) {
  const raw = jsonldFirstValue(node, uri);
  if (raw === undefined || raw === null) return defaultValue;
  return raw === true || raw === 'true';
}

/**
 * Mirror the JSON-LD framing/compaction default of single-valued arrays
 * collapsing to scalars. Returns:
 *   - null when no values
 *   - the bare scalar when there's exactly one
 *   - an array when there are multiple
 *
 * Used for csl:* fields that ae-std emits as arrays but ES emits as scalars
 * when only one value is present (e.g. ISBN, container-title, collection-number).
 */
function jsonldCollapse(node, uri) {
  const values = jsonldAllValues(node, uri);
  if (!values.length) return null;
  if (values.length === 1) return values[0];
  return values;
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
 * Pad a partial date string ("2023", "2023-04", "2023-04-15") to a full date
 * suitable for storage in a DATE column. Returns null when input is missing
 * or unparseable.
 */
function partialDateToFull(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}$/.test(trimmed))         return `${trimmed}-01-01`;
  if (/^\d{4}-\d{2}$/.test(trimmed))   return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Try Date parse as a last resort (e.g. ISO timestamps)
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/**
 * Resolve a vcard:hasName reference to the compact { @id, @type, family,
 * given, middle, pronouns } shape ES emits.
 */
function resolveVcardName(ref, nodeMap) {
  const node = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
    ? ref
    : nodeMap[ref?.['@id']];
  if (!node) return null;

  const out = { '@id': node['@id'] };
  const typeRaw = asArray(node['@type'])[0];
  if (typeRaw) out['@type'] = compactVcardType(typeRaw);

  const family   = jsonldFirstValue(node, URI.VCARD_FAMILY_NAME);
  const given    = jsonldFirstValue(node, URI.VCARD_GIVEN_NAME);
  const middle   = jsonldFirstValue(node, URI.VCARD_MIDDLE_NAME);
  const pronouns = jsonldFirstValue(node, URI.VCARD_PRONOUNS);
  if (family   != null) out.family   = family;
  if (given    != null) out.given    = given;
  if (middle   != null) out.middle   = middle;
  if (pronouns != null) out.pronouns = pronouns;
  return out;
}

/**
 * Resolve a vcard:hasOrganizationalUnit or vcard:hasTitle reference to the
 * compact { @id, @type, name } shape ES emits. Both Organization and Title
 * nodes store their display text in `vcard:title`; we surface it as `name`.
 */
function resolveVcardOrgOrTitle(ref, nodeMap) {
  const node = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
    ? ref
    : nodeMap[ref?.['@id']];
  if (!node) return null;

  const out = { '@id': node['@id'] };
  const typeRaw = asArray(node['@type'])[0];
  if (typeRaw) out['@type'] = compactVcardType(typeRaw);

  const name = jsonldFirstValue(node, URI.VCARD_TITLE);
  if (name != null) out.name = name;
  return out;
}

/**
 * Resolve a vcard:hasURL reference list to the compact
 * [{ @id, @type, rank, url }] shape ES emits. URL @ids get the experts.ucdavis
 * base stripped; @type collapses to short form ("URL").
 */
function resolveUrlNodes(vcardNode, nodeMap) {
  return asArray(vcardNode?.[URI.VCARD_HAS_URL]).map(ref => {
    const node = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
      ? ref
      : nodeMap[ref?.['@id']];
    if (!node) return null;

    const url = jsonldFirstValue(node, URI.VCARD_URL) || node['@id'];
    if (!url) return null;

    const types = asArray(node['@type'])
      .map(compactVcardType)
      .filter(Boolean);
    // ES sometimes adds a URL_<api:type> sibling; drop those — only "URL" is
    // emitted in the compacted ES response.
    const shortTypes = types.filter(t => t === 'URL');

    const out = {
      '@id': stripAeBase(node['@id']),
      '@type': shortTypes.length ? shortTypes : types
    };

    const rankRaw = jsonldFirstValue(node, URI.RANK);
    const rankNum = Number(rankRaw);
    if (Number.isFinite(rankNum)) out.rank = rankNum;

    out.url = url;
    return out;
  }).filter(Boolean);
}

/**
 * Normalize an ae-std person.jsonld payload (expanded JSON-LD array) into a
 * flat object holding just the fields the sitefarm API exposes. Returns null
 * when the document doesn't contain a recognizable Expert node.
 */
function normalizeAeStdPersonDoc(aeStdData) {
  if (!Array.isArray(aeStdData)) return null;

  const nodeMap = {};
  for (const node of aeStdData) {
    if (node?.['@id']) nodeMap[node['@id']] = node;
  }

  const expertNode = aeStdData.find(n => asArray(n['@type']).includes(URI.EXPERT_TYPE));
  if (!expertNode) return null;

  const orcidId      = jsonldFirstValue(expertNode, URI.ORCID) || null;
  const researcherId = jsonldFirstValue(expertNode, URI.RESEARCHER) || null;
  // Experts may carry multiple scopus IDs; preserve the full list. The API
  // response collapses single→scalar / multi→array to match ES output.
  const scopusIds    = jsonldAllValues(expertNode, URI.SCOPUS);
  const overview     = jsonldFirstValue(expertNode, URI.OVERVIEW) || null;
  const researchInterests = jsonldFirstValue(expertNode, URI.RESEARCH_INTERESTS) || null;
  const isVisible    = jsonldBool(expertNode, URI.IS_VISIBLE, false);

  // Walk vcard:Individual nodes to assemble contactInfo. Sitefarm needs:
  //   - the preferred entry (isPreferred=true), and
  //   - the rank=20 (OAP) entry, which holds the website list via hasURL refs.
  const vcards = aeStdData.filter(n => asArray(n['@type']).includes(URI.VCARD_INDIVIDUAL));

  function vcardToContactBlock(vcardNode) {
    if (!vcardNode) return null;
    const block = {};

    // schema:name on the vcard is the formatted-display string ES emits at
    // the top of contactInfo (e.g. "Bishop, Matthew § Professor, Computer Science")
    const name = jsonldFirstValue(vcardNode, URI.SCHEMA_NAME);
    if (name) block.name = name;

    const email = jsonldFirstValue(vcardNode, URI.VCARD_HAS_EMAIL);
    if (email) block.hasEmail = email;

    const nameRef = asArray(vcardNode[URI.VCARD_HAS_NAME])[0];
    if (nameRef) {
      const name = resolveVcardName(nameRef, nodeMap);
      if (name) block.hasName = name;
    }

    const orgRef = asArray(vcardNode[URI.VCARD_HAS_ORG])[0];
    if (orgRef) {
      const org = resolveVcardOrgOrTitle(orgRef, nodeMap);
      if (org) block.hasOrganizationalUnit = org;
    }

    const titleRef = asArray(vcardNode[URI.VCARD_HAS_TITLE])[0];
    if (titleRef) {
      const title = resolveVcardOrgOrTitle(titleRef, nodeMap);
      if (title) block.hasTitle = title;
    }

    const urls = resolveUrlNodes(vcardNode, nodeMap);
    if (urls.length) block.hasURL = urls;

    return block;
  }

  const preferred = vcards.find(v => jsonldBool(v, URI.IS_PREFERRED, false));
  // rank=20 vcard is the OAP/CDL websites bucket per the person.js transform
  const websitesVcard = vcards.find(v => Number(jsonldFirstValue(v, URI.RANK)) === 20);

  // Assemble contactInfo from the preferred vcard, then layer the rank=20
  // vcard's hasURL list on top (since the preferred vcard typically doesn't
  // carry websites — those live in the OAP/CDL block).
  const contactInfo = {};
  if (preferred) Object.assign(contactInfo, vcardToContactBlock(preferred));
  if (websitesVcard && websitesVcard !== preferred) {
    const block = vcardToContactBlock(websitesVcard);
    if (block?.hasURL) contactInfo.hasURL = block.hasURL;
  }

  return {
    expert_id_uri: expertNode['@id'] || null,
    orcid_id: orcidId,
    researcher_id: researcherId,
    scopus_ids: scopusIds,
    overview,
    research_interests: researchInterests,
    contact_info: Object.keys(contactInfo).length ? contactInfo : null,
    is_visible: isVisible,
    expert_raw_payload: expertNode
  };
}

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
 * Normalize an ae-std work relationship document (rel/*.jsonld). Returns the
 * compacted `{ '@graph': [workNode] }` shape that buildWorkRecord/buildWorkRoles
 * understand.
 *
 * The ae-std rel doc is a JSON-LD array containing:
 *   - the publication node (csl:* bibliographic fields, csl:author refs, etc.)
 *   - one author node per author position (csl:family, csl:given, vivo:rank)
 *   - the Authorship relationship node (vivo:relates: [publicationUri, expertUri],
 *     schema:is-visible, schema:favourite, vivo:rank)
 *
 * We compact this into the shape the webapp ES path returns: short-form types,
 * author array with given/family/rank, and a relatedBy[] with each authorship
 * node's metadata.
 */
function normalizeAeStdWorkDoc(aeStdData) {
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
  // shape that consumers expect. Sort by rank so positions are deterministic.
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
  // Single-valued — emit as a scalar object (not an array).
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

// Identify the work node in a compacted webapp-shape doc. After
// normalizeAeStdWorkDoc runs, @type contains short forms — "Work" is always
// present (ae-std works.js emits ucdlib:Work alongside the schema.org type).
function getWorkNode(workDoc={}) {
  return asArray(workDoc['@graph']).find(node => {
    const types = asArray(node?.['@type']);
    return types.includes('Work') || types.includes(URI.WORK_TYPE);
  }) || null;
}

function buildWorkRecord(workDoc={}) {
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

function buildWorkRoles(workDoc={}) {
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

/**
 * Build the expert profile record consumed by upsertUserProfile. Pulled from
 * ae-std/person.jsonld so the postgres API path is decoupled from ae-webapp.
 */
function buildUserProfileRecord({ metadata={}, aeStdPersonDoc=null }) {
  if (!aeStdPersonDoc) return null;
  const normalized = normalizeAeStdPersonDoc(aeStdPersonDoc);
  if (!normalized) return null;

  const expertId = normalizeExpertId(normalized.expert_id_uri || metadata.expertId);
  if (!expertId) return null;

  return {
    expert_id:          expertId,
    orcid_id:           normalized.orcid_id,
    researcher_id:      normalized.researcher_id,
    scopus_ids:         normalized.scopus_ids,
    overview:           normalized.overview,
    research_interests: normalized.research_interests,
    contact_info:       normalized.contact_info,
    expert_raw_payload: normalized.expert_raw_payload
  };
}

async function upsertUserProfile(client, schema, row) {
  await client.query(
    `UPDATE ${schema}."user"
       SET orcid_id           = $2,
           researcher_id      = $3,
           scopus_ids         = $4::text[],
           overview           = $5,
           research_interests = $6,
           contact_info       = $7,
           expert_raw_payload = $8,
           last_seen_cdl      = CURRENT_TIMESTAMP
     WHERE expert_id = $1`,
    [
      row.expert_id,
      row.orcid_id,
      row.researcher_id,
      Array.isArray(row.scopus_ids) && row.scopus_ids.length ? row.scopus_ids : null,
      row.overview,
      row.research_interests,
      row.contact_info,
      row.expert_raw_payload
    ]
  );
}

async function upsertWork(client, schema, row) {
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

async function replaceWorkRoles(client, schema, workId, roles) {
  await client.query(`DELETE FROM ${schema}.expert_work_role WHERE work_id = $1`, [workId]);

  // ensure all role types exist in the shared role_type table
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

/**
 * Load the sitefarm projection (expert profile + works) into postgres for a
 * single user. Mirrors loadMivPostgres but reads expert fields from
 * ae-std/person.jsonld and walks the work files passed in.
 *
 * Expects `files` to contain a `personAeStd` entry (path to ae-std/person.jsonld)
 * and zero or more `work` entries (paths to ae-std/rel/{relationshipUri}.jsonld).
 */
async function loadSitefarmPostgres({ user, metadata={}, files=[] }) {
  const schema = getSchemaName();
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

async function purgeSitefarmPostgresExpert(expertId) {
  if (!expertId) return;

  const schema = getSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient();
  const normalizedExpertId = normalizeExpertId(expertId);
  if (!normalizedExpertId) return;

  try {
    await pgClient.query('BEGIN');

    // remove this expert's roles, then orphaned works
    await pgClient.query(`DELETE FROM ${schema}.expert_work_role WHERE expert_id = $1`, [normalizedExpertId]);
    await pgClient.query(
      `DELETE FROM ${schema}."work" w
       WHERE NOT EXISTS (
         SELECT 1 FROM ${schema}.expert_work_role wr WHERE wr.work_id = w.work_id
       )`
    );

    // clear the sitefarm-specific profile columns; identity columns are
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

async function purgeMivPostgresExpert(expertId) {
  if (!expertId) return;

  const schema = getSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient();
  const normalizedExpertId = normalizeExpertId(expertId);

  if (!normalizedExpertId) return;

  try {
    await pgClient.query('BEGIN');

    await pgClient.query(`DELETE FROM ${schema}.expert_grant_role WHERE expert_id = $1`, [normalizedExpertId]);

    await pgClient.query(
      `DELETE FROM ${schema}."grant" g
       WHERE NOT EXISTS (
         SELECT 1 FROM ${schema}.expert_grant_role gr WHERE gr.grant_id = g.grant_id
       )`
    );

    await pgClient.query(
      `UPDATE ${schema}."user"
       SET expert_id = NULL,
           ucd_person_uuid = NULL,
           iam_id = NULL,
           display_name = NULL,
           last_seen_cdl = CURRENT_TIMESTAMP
       WHERE expert_id = $1`,
      [normalizedExpertId]
    );

    await pgClient.query('COMMIT');
    logger.info({ expertId }, 'MIV postgres expert purge completed');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    await pgClient.end();
  }
}

function captureErrors() {
  process.on('uncaughtException', async (err) => {
    await captureError(err);
    await config.postgres.client.end();

    console.error(err);
    process.exit(1);
  });
  process.on('unhandledRejection', async (reason, promise) => {
    await captureError(reason);
    await config.postgres.client.end();

    console.error(reason);
    process.exit(1);
  });
}

async function enableFromCli(command, user, options) {
  let weekYearInfo = getYearWeek({allValues: true, asString: true});

  config.reporting.enabled = true;
  config.reporting.jobId = options.reportingJobId || config.reporting.jobId;
  config.reporting.command = command;
  config.reporting.opts = options;
  config.reporting.yearWeek = weekYearInfo.yearWeek;
  config.reporting.weekStart = weekYearInfo.weekStart;
  config.reporting.userId = user;
  config.postgres.client = new PgClient();
  let commandId = await config.postgres.client.insertCommand({
    job_id: config.reporting.jobId,
    command: config.reporting.command,
    year_week: config.reporting.yearWeek,
    week_start: config.reporting.weekStart,
    user_id: config.reporting.userId,
    options: config.reporting.opts
  });
  config.reporting.commandId = commandId;
  captureErrors();
}

/**
 * @method cleanup
 * @description Clean up old commands and user entries from the reporting database. 
 * Deletes commands older than the specified number of weeks.  If an option is 
 * not specified, it will not be cleaned up.
 * 
 * @param {Object} opts 
 * @param {number} opts.commands - Number of weeks to keep commands. Deletes commands older than this.
 * @param {number} opts.users - Number of weeks to keep user cache entries. Deletes entries older than this.
 * @param {PgClient} opts.pgClient - Optional PgClient instance to use for database operations. If not provided, a new instance will be created.
 * 
 * @returns {Promise<void>}
 */
async function cleanup(opts={}) {
  let pgClient = opts.pgClient || config.postgres.client;
  let closeClient = false;
  
  if( !pgClient ) {
    pgClient = new PgClient();
    await pgClient.connect();
    closeClient = true;
  }

  let result = {};

  if( opts.commands ) {
    console.log('Cleaning up old commands more than', opts.commands, 'weeks old...');
    let resp = await pgClient.query(`SELECT * FROM ${pgClient.schema}.cleanup_old_commands(${opts.commands})`);
    result = Object.assign(result, resp.rows[0]);
  }

  if( opts.users ) {
    console.log('Cleaning up old user cache more than', opts.users, 'weeks old...');
    let resp = await pgClient.query(`SELECT * FROM ${pgClient.schema}.cleanup_old_users(${opts.users})`);
    result = Object.assign(result, resp.rows[0]);
  }

  if( closeClient ) {
    await pgClient.end();
  }

  return result;
}


export {
  cleanup,
  enableFromCli,
  captureErrors,
  updateEsIndex,
  initYearWeek,
  loadMivPostgres,
  purgeMivPostgresExpert,
  loadSitefarmPostgres,
  purgeSitefarmPostgresExpert
}