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

function getSchemaName() {
  return 'etl_reporting';
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

async function replaceGrantRoles(client, schema, grantId, roles) {
  await client.query(`DELETE FROM ${schema}.expert_grant_role WHERE grant_id = $1`, [grantId]);

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
    ? { '@id': assignedByNode['@id'], name: getFirstValue(assignedByNode, 'http://schema.org/name') }
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
      start: startNode ? { dateTime: getFirstValue(startNode, 'http://vivoweb.org/ontology/core#dateTime') } : undefined,
      end:   endNode   ? { dateTime: getFirstValue(endNode,   'http://vivoweb.org/ontology/core#dateTime') } : undefined
    };
  }

  // get relatedBy role refs (some may be inline objects, some just { @id } refs)
  const BASE_URL = 'http://experts.ucdavis.edu/';
  const stripBase = id => (typeof id === 'string' && id.startsWith(BASE_URL)) ? id.slice(BASE_URL.length) : id;

  const relatedBy = asArray(grantNode['http://vivoweb.org/ontology/core#relatedBy']).map(ref => {
    // inline role objects have keys beyond just @id; pure refs have only @id
    const roleNode = (Object.keys(ref).length > 1) ? ref : nodeMap[ref['@id']];
    if( !roleNode ) return { '@id': ref['@id'] };

    const relates = asArray(roleNode['http://vivoweb.org/ontology/core#relates'])
      .map(r => stripBase(r['@id'] || r))
      .filter(Boolean);

    const isVisibleRaw = asArray(roleNode['http://schema.library.ucdavis.edu/schema#is-visible'])[0]?.['@value'];
    const isVisible = isVisibleRaw === 'true' || isVisibleRaw === true;

    return {
      '@id': roleNode['@id'],
      '@type': asArray(roleNode['@type']).map(toShortType),
      relates,
      'is-visible': isVisible
    };
  });

  const rawTypes = asArray(grantNode['@type']);
  const shortTypes = rawTypes.map(toShortType);

  return {
    '@graph': [{
      '@id':              grantNode['@id'],
      '@type':            Array.from(new Set([...shortTypes, ...rawTypes])),
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
      await replaceGrantRoles(pgClient, schema, grantRecord.grant_id, buildGrantRoles(grantDoc));
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

// Common JSON-LD URI constants used by the ae-std normalizers
const URI = {
  EXPERT_TYPE:        'http://schema.library.ucdavis.edu/schema#Expert',
  WORK_TYPE:          'http://schema.library.ucdavis.edu/schema#Work',
  WORK_BIBO:          'http://purl.org/ontology/bibo/',          // namespace prefix
  IS_VISIBLE:         'http://schema.library.ucdavis.edu/schema#is-visible',
  IS_PREFERRED:       'http://schema.library.ucdavis.edu/schema#isPreferred',
  RESEARCH_INTERESTS: 'http://schema.library.ucdavis.edu/schema#researchInterests',
  FAVOURITE:          'http://schema.library.ucdavis.edu/schema#favourite',
  ORCID:              'http://vivoweb.org/ontology/core#orcidId',
  SCOPUS:             'http://vivoweb.org/ontology/core#scopusId',
  RESEARCHER:         'http://vivoweb.org/ontology/core#researcherId',
  OVERVIEW:           'http://vivoweb.org/ontology/core#overview',
  RANK:               'http://vivoweb.org/ontology/core#rank',
  RELATES:            'http://vivoweb.org/ontology/core#relates',
  RELATED_BY:         'http://vivoweb.org/ontology/core#relatedBy',
  DATE_ISSUED:        'http://purl.org/dc/terms/issued',
  CITATION_ISSUED:    'http://citationstyles.org/schema/issued',
  SCHEMA_NAME:        'http://schema.org/name',
  SCHEMA_IDENTIFIER:  'http://schema.org/identifier',
  TITLE:              'http://purl.org/dc/terms/title',
  ABSTRACT:           'http://purl.org/dc/terms/abstract',
  DOI_BIBO:           'http://purl.org/ontology/bibo/doi',
  VOLUME:             'http://purl.org/ontology/bibo/volume',
  PAGES:              'http://purl.org/ontology/bibo/pages',
  CONTAINER_TITLE:    'http://purl.org/ontology/bibo/shortTitle',
  STATUS:             'http://citationstyles.org/schema/status',
  VCARD_INDIVIDUAL:   'http://www.w3.org/2006/vcard/ns#Individual',
  VCARD_HAS_URL:      'http://www.w3.org/2006/vcard/ns#hasURL',
  VCARD_URL:          'http://www.w3.org/2006/vcard/ns#url',
  VCARD_HAS_EMAIL:    'http://www.w3.org/2006/vcard/ns#hasEmail',
  VCARD_HAS_NAME:     'http://www.w3.org/2006/vcard/ns#hasName'
};

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
  // scopusId may be multivalued — preserve the first for the dedicated column,
  // full list lives in expert_raw_payload.
  const scopusValues = jsonldAllValues(expertNode, URI.SCOPUS);
  const scopusId     = scopusValues[0] || null;
  const overview     = jsonldFirstValue(expertNode, URI.OVERVIEW) || null;
  const researchInterests = jsonldFirstValue(expertNode, URI.RESEARCH_INTERESTS) || null;
  const isVisible    = jsonldBool(expertNode, URI.IS_VISIBLE, false);

  // Walk vcard:Individual nodes to assemble contactInfo. Sitefarm needs:
  //   - the preferred entry (isPreferred=true), and
  //   - the rank=20 (OAP) entry, which holds the website list via hasURL refs.
  const vcards = aeStdData.filter(n => asArray(n['@type']).includes(URI.VCARD_INDIVIDUAL));

  function resolveUrlNodes(vcardNode) {
    const urlRefs = asArray(vcardNode?.[URI.VCARD_HAS_URL]);
    return urlRefs.map(ref => {
      const urlNode = (typeof ref === 'object' && ref['@id']) ? (nodeMap[ref['@id']] || ref) : null;
      if (!urlNode) return null;
      const url = jsonldFirstValue(urlNode, URI.VCARD_URL) || urlNode['@id'];
      return url ? {
        '@id': urlNode['@id'],
        '@type': asArray(urlNode['@type']),
        url
      } : null;
    }).filter(Boolean);
  }

  function vcardToContactBlock(vcardNode) {
    if (!vcardNode) return null;
    const block = {
      '@id': vcardNode['@id'],
      isPreferred: jsonldBool(vcardNode, URI.IS_PREFERRED, false),
      rank: Number(jsonldFirstValue(vcardNode, URI.RANK)) || null,
      name: jsonldFirstValue(vcardNode, URI.SCHEMA_NAME) || null
    };
    const email = jsonldFirstValue(vcardNode, URI.VCARD_HAS_EMAIL);
    if (email) block.hasEmail = email;
    const urls = resolveUrlNodes(vcardNode);
    if (urls.length) block.hasURL = urls;
    return block;
  }

  const preferred = vcards.find(v => jsonldBool(v, URI.IS_PREFERRED, false));
  // rank=20 vcard is the OAP/CDL websites bucket per the person.js transform
  const websitesVcard = vcards.find(v => Number(jsonldFirstValue(v, URI.RANK)) === 20);

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
    scopus_id: scopusId,
    overview,
    research_interests: researchInterests,
    contact_info: Object.keys(contactInfo).length ? contactInfo : null,
    is_visible: isVisible,
    expert_raw_payload: expertNode
  };
}

/**
 * Normalize an ae-std work relationship document (rel/*.jsonld). Returns the
 * compacted `{ '@graph': [workNode] }` shape that buildWorkRecord/buildWorkRoles
 * understand. The ae-std rel doc contains the Authorship (relationship) node,
 * the work node it points to, and any inline author/role nodes.
 */
function normalizeAeStdWorkDoc(aeStdData) {
  if (!Array.isArray(aeStdData)) return aeStdData;

  const nodeMap = {};
  for (const node of aeStdData) {
    if (node?.['@id']) nodeMap[node['@id']] = node;
  }

  // Identify the work node. ae-std uses bibo/* and vivo:* work-ish types.
  const isWorkType = (t) => {
    if (typeof t !== 'string') return false;
    return t === URI.WORK_TYPE
        || t.startsWith(URI.WORK_BIBO)
        || t === 'http://vivoweb.org/ontology/core#ConferencePaper';
  };
  const workNode = aeStdData.find(n => asArray(n['@type']).some(isWorkType));
  if (!workNode) return null;

  const BASE_URL = 'http://experts.ucdavis.edu/';
  const stripBase = id => (typeof id === 'string' && id.startsWith(BASE_URL))
    ? id.slice(BASE_URL.length)
    : id;

  // relatedBy: pull the authorship/role nodes. These may be inline objects on
  // the work node, or referenced by @id.
  const relatedBy = asArray(workNode[URI.RELATED_BY]).map(ref => {
    const roleNode = (ref && Object.keys(ref).length > 1) ? ref : nodeMap[ref['@id']];
    if (!roleNode) return { '@id': ref['@id'] };

    const relates = asArray(roleNode[URI.RELATES])
      .map(r => stripBase(r?.['@id'] || r))
      .filter(Boolean);

    return {
      '@id': roleNode['@id'],
      '@type': asArray(roleNode['@type']).map(toShortType),
      relates,
      'is-visible': jsonldBool(roleNode, URI.IS_VISIBLE, false),
      'ucdlib:favourite': jsonldBool(roleNode, URI.FAVOURITE, false),
      rank: Number(jsonldFirstValue(roleNode, URI.RANK)) || null
    };
  });

  const rawTypes = asArray(workNode['@type']);
  const shortTypes = rawTypes.map(toShortType);

  const issued = jsonldFirstValue(workNode, URI.DATE_ISSUED)
              ?? jsonldFirstValue(workNode, URI.CITATION_ISSUED)
              ?? null;

  return {
    '@graph': [{
      '@id':            workNode['@id'],
      '@type':          Array.from(new Set([...shortTypes, ...rawTypes])),
      title:            jsonldFirstValue(workNode, URI.TITLE) ?? null,
      issued,
      'container-title': jsonldFirstValue(workNode, URI.CONTAINER_TITLE) ?? null,
      volume:           jsonldFirstValue(workNode, URI.VOLUME) ?? null,
      page:             jsonldFirstValue(workNode, URI.PAGES) ?? null,
      DOI:              jsonldFirstValue(workNode, URI.DOI_BIBO) ?? null,
      abstract:         jsonldFirstValue(workNode, URI.ABSTRACT) ?? null,
      status:           jsonldFirstValue(workNode, URI.STATUS) ?? null,
      relatedBy
    }]
  };
}

function getWorkNode(workDoc={}) {
  return asArray(workDoc['@graph']).find(node => {
    const types = asArray(node?.['@type']);
    return types.some(t => typeof t === 'string'
      && (t === 'Work'
          || t === URI.WORK_TYPE
          || t.startsWith('Article')
          || t.startsWith('Book')
          || t.startsWith('Chapter')
          || t === 'ConferencePaper'
          || t.startsWith(URI.WORK_BIBO)));
  }) || null;
}

function buildWorkRecord(workDoc={}) {
  const workNode = getWorkNode(workDoc);
  if (!workNode?.['@id']) return null;

  const issuedRaw = workNode.issued || null;

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
    work_type_uris:  asArray(workNode['@type']).filter(t => typeof t === 'string')
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
    scopus_id:          normalized.scopus_id,
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
           scopus_id          = $4,
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
      row.scopus_id,
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
             scopus_id          = NULL,
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