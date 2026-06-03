/**
 * Shared JSON-LD utilities used by the api/ schema loaders.
 *
 * The api projection loaders (miv, sitefarm, user-identity) all read ae-std
 * documents — which are expanded JSON-LD arrays with full URI keys and
 * `[{ "@value": "..." }]` shaped values — and compact them into the webapp-
 * shape JSON that the API endpoints return. This module centralizes:
 *
 *   - the URI constants used to address ae-std nodes
 *   - small accessors (jsonldFirstValue / jsonldAllValues / jsonldBool /
 *     jsonldCollapse) that hide the `[{ "@value": ... }]` wrapping
 *   - the TYPE_COMPACTION table and compactType helper that mirror the
 *     ES JSON-LD context's type-shortening rules
 *   - general JSON-LD plumbing (asArray, hasType, normalizeExpertId,
 *     stripAeBase, partialDateToFull, readJson)
 *
 * Keep this module side-effect-free and free of database / cache state so it
 * can be imported anywhere without dragging in a connection or filesystem.
 */

import cache from './cache.js';

// ----------------------------------------------------------------------------
// URI constants
// ----------------------------------------------------------------------------
// The publication nodes emitted by harvest/lib/transform/ae-std/works.js use
// the citation-style (csl) vocabulary — NOT bibo or dcterms — for almost every
// bibliographic field. The expert (person) nodes use schema.org + vivo +
// vcard. Mirror that here so the normalizers extract everything cleanly.
export const URI = {
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
  // Citation Styles vocabulary (csl) — publication bibliographic fields
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
  // schema.org
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
  VCARD_TITLE:        'http://www.w3.org/2006/vcard/ns#title',
  // Grant (vivo)
  GRANT_TYPE:         'http://vivoweb.org/ontology/core#Grant',
  ASSIGNED_BY:        'http://vivoweb.org/ontology/core#assignedBy',
  DATE_TIME_INTERVAL: 'http://vivoweb.org/ontology/core#dateTimeInterval',
  DATE_TIME_START:    'http://vivoweb.org/ontology/core#start',
  DATE_TIME_END:      'http://vivoweb.org/ontology/core#end',
  DATE_TIME:          'http://vivoweb.org/ontology/core#dateTime',
  DATE_TIME_PRECISION:'http://vivoweb.org/ontology/core#dateTimePrecision',
  SPONSOR_AWARD_ID:   'http://vivoweb.org/ontology/core#sponsorAwardId',
  TOTAL_AWARD_AMOUNT: 'http://vivoweb.org/ontology/core#totalAwardAmount',
  // Relations Ontology — used for inheres-in on roles
  RO_INHERES_IN:      'http://purl.obolibrary.org/obo/RO_0000052'
};

// Base URL that ae-std uses for expert/* relative IDs. The ES api responses
// return these as short forms (e.g. "expert/abc123#vcard-oap-1-web-0"); we
// strip the base to match.
export const AE_BASE_URL = 'http://experts.ucdavis.edu/';

export function stripAeBase(id) {
  return (typeof id === 'string' && id.startsWith(AE_BASE_URL))
    ? id.slice(AE_BASE_URL.length)
    : id;
}

// ----------------------------------------------------------------------------
// Type compaction
// ----------------------------------------------------------------------------
// JSON-LD context-driven type compaction is non-uniform in the ES api output:
// types with named terms in the webapp context collapse to bare names (Work,
// Authorship, Name, URL, Title, ScholarlyArticle, …) while unmapped types
// keep their namespace prefix (vcard:Organization, ucdlib:Authorship,
// vcard:Individual). Hardcode the mapping to match what ES emits, since we're
// not running the JSON-LD framing machinery ourselves.
//
// To add a new type: run the diff against ES, see how the type appears in the
// response, and add an entry here. Unmapped types fall back to toShortType,
// which usually produces a bare name.
export const TYPE_COMPACTION = {
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

export function toShortType(type) {
  if (typeof type !== 'string') return type;
  if (type.includes('#')) return type.split('#').pop();
  if (type.includes('/')) return type.split('/').pop();
  return type;
}

export function compactType(t) {
  if (typeof t !== 'string') return t;
  return TYPE_COMPACTION[t] || toShortType(t);
}

export function toShortPrecision(precision) {
  if (typeof precision !== 'string') return precision;
  if (precision.startsWith('http://vivoweb.org/ontology/core#')) {
    return 'vivo:' + precision.split('#').pop();
  }
  return precision;
}

// ----------------------------------------------------------------------------
// Generic JSON-LD helpers
// ----------------------------------------------------------------------------
export function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function hasType(node, type) {
  return asArray(node?.['@type']).includes(type);
}

/**
 * Pull the first value out of a JSON-LD property. Handles both @value (literal)
 * and @id (reference) wrapping, plus bare scalars. Returns undefined when
 * absent.
 */
export function jsonldFirstValue(node, uri) {
  const first = asArray(node?.[uri])[0];
  if (first === undefined || first === null) return undefined;
  return first['@value'] ?? first['@id'] ?? undefined;
}

/**
 * Pull ALL values out of a JSON-LD property as a flat array of bare scalars.
 */
export function jsonldAllValues(node, uri) {
  return asArray(node?.[uri])
    .map(v => (v && typeof v === 'object') ? (v['@value'] ?? v['@id']) : v)
    .filter(v => v !== undefined && v !== null);
}

/**
 * Boolean coercion: ae-std stores booleans as `[{ "@type": "xsd:boolean",
 * "@value": "true" }]`. Treat both string "true" and boolean true as true.
 */
export function jsonldBool(node, uri, defaultValue=false) {
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
 * when only one value is present (e.g. ISBN, container-title, scopusId).
 */
export function jsonldCollapse(node, uri) {
  const values = jsonldAllValues(node, uri);
  if (!values.length) return null;
  if (values.length === 1) return values[0];
  return values;
}

// ----------------------------------------------------------------------------
// Domain-specific helpers
// ----------------------------------------------------------------------------

export function normalizeExpertId(value) {
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

export function getExpertIdFromRole(role={}) {
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

export function pickRoleType(role={}) {
  const types = asArray(role['@type']);
  return types[0] || null;
}

export function toDateOrNull(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function toNumberOrNull(value) {
  if (value === undefined || value === null) return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

export function trimGrantTitle(title='') {
  if (typeof title !== 'string') return null;
  return title.split('§')[0].trim() || null;
}

/**
 * Pad a partial date string ("2023", "2023-04", "2023-04-15") to a full date
 * suitable for storage in a DATE column. Returns null when input is missing
 * or unparseable.
 */
export function partialDateToFull(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}$/.test(trimmed))             return `${trimmed}-01-01`;
  if (/^\d{4}-\d{2}$/.test(trimmed))       return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Try Date parse as a last resort (e.g. ISO timestamps)
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/**
 * Read a JSON file from caskfs if it exists; return null otherwise.
 */
export async function readJson(path) {
  if (!path || !await cache.exists(path)) return null;
  return JSON.parse(await cache.read(path));
}

// ----------------------------------------------------------------------------
// Schema name (for the api schema, used in all UPDATE/INSERT SQL).
// ----------------------------------------------------------------------------
export function getApiSchemaName() {
  return 'api';
}

export function assertSchemaName(schema) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid postgres schema name: ${schema}`);
  }
}
