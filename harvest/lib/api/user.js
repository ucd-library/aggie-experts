/**
 * Shared `api."user"` builders + upserts.
 *
 * The user table is the identity backbone shared between the MIV and SiteFarm
 * projections. Both loaders write to it:
 *   - loadMivPostgres calls upsertUser to ensure identity columns
 *   - loadSitefarmPostgres calls upsertUserProfile to overlay profile fields
 *
 * Identity columns (email, expert_id, ucd_person_uuid, iam_id, display_name)
 * are sourced from the webapp/expert.jsonld doc; profile columns (orcid_id,
 * researcher_id, scopus_ids, overview, research_interests, contact_info,
 * expert_raw_payload) are sourced from ae-std/person.jsonld.
 */

import {
  URI,
  asArray,
  hasType,
  normalizeExpertId,
  jsonldFirstValue,
  jsonldAllValues,
  jsonldBool,
  compactType as compactVcardType,
  stripAeBase
} from '../pg-jsonld.js';

// ----------------------------------------------------------------------------
// Identity record (from webapp/expert.jsonld)
// ----------------------------------------------------------------------------

function getExpertNode(expertDoc={}) {
  return asArray(expertDoc['@graph']).find(node => hasType(node, 'Expert')) || null;
}

export function buildUserRecord({ user, metadata={}, expertDoc={} }) {
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

export async function upsertUser(client, schema, row) {
  await client.query(
    `INSERT INTO ${schema}."user"
      (email, expert_id, ucd_person_uuid, iam_id, display_name, last_seen_cdl)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (email)
     DO UPDATE SET
      expert_id       = EXCLUDED.expert_id,
      ucd_person_uuid = EXCLUDED.ucd_person_uuid,
      iam_id          = EXCLUDED.iam_id,
      display_name    = EXCLUDED.display_name,
      last_seen_cdl   = CURRENT_TIMESTAMP`,
    [row.email, row.expert_id, row.ucd_person_uuid, row.iam_id, row.display_name]
  );
}

// ----------------------------------------------------------------------------
// Profile record (from ae-std/person.jsonld) — vcard helpers below
// ----------------------------------------------------------------------------

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

    const types = asArray(node['@type']).map(compactVcardType).filter(Boolean);
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
export function normalizeAeStdPersonDoc(aeStdData) {
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
      const resolvedName = resolveVcardName(nameRef, nodeMap);
      if (resolvedName) block.hasName = resolvedName;
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
 * Build the expert profile record consumed by upsertUserProfile.
 */
export function buildUserProfileRecord({ metadata={}, aeStdPersonDoc=null }) {
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

export async function upsertUserProfile(client, schema, row) {
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
