/**
 * Shared `api."user"` builders + upserts.
 *
 * The user table is the identity backbone shared between the MIV and SiteFarm
 * projections. Both loaders write to it:
 *   - MivApi calls upsertUser to ensure identity columns
 *   - SitefarmApi calls upsertUserProfile to overlay profile fields
 *
 * Identity columns (email, expert_id, ucd_person_uuid, iam_id, display_name)
 * are sourced from the webapp/expert.jsonld doc; profile columns (orcid_id,
 * researcher_id, scopus_ids, overview, research_interests, contact_info,
 * expert_raw_payload) are sourced from ae-std/person.jsonld.
 */

import PgJsonld from '../pg-jsonld.js';

class ApiUser {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.schema='api'] - schema name to write into
   */
  constructor({ schema = PgJsonld.SCHEMA_NAME } = {}) {
    PgJsonld.assertSchemaName(schema);
    this.schema = schema;
  }

  // --------------------------------------------------------------------------
  // Identity record (from webapp/expert.jsonld)
  // --------------------------------------------------------------------------

  _getExpertNode(expertDoc={}) {
    return PgJsonld.asArray(expertDoc['@graph'])
      .find(node => PgJsonld.hasType(node, 'Expert')) || null;
  }

  buildUserRecord({ user, metadata={}, expertDoc={} }) {
    const expertNode = this._getExpertNode(expertDoc) || {};
    const expertId = PgJsonld.normalizeExpertId(metadata.expertId || expertDoc['@id']);
    const email = expertNode?.contactInfo?.hasEmail || expertNode?.hasEmail || user || null;

    if (!expertId || !email) return null;

    return {
      email,
      expert_id: expertId,
      ucd_person_uuid: metadata?.ucdPersonUUID || null,
      iam_id: metadata?.iamId || null,
      display_name: expertNode?.name || expertNode?.contactInfo?.name || null
    };
  }

  /**
   * Upsert the identity columns for a user. yearWeek is the current ETL batch
   * identifier (e.g. "2026-22"); it's written to the year_week column so we
   * can tell which weekly run last touched this row.
   */
  async upsertUser(client, row, yearWeek) {
    await client.query(
      `INSERT INTO ${this.schema}."user"
        (email, expert_id, ucd_person_uuid, iam_id, display_name, year_week)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email)
       DO UPDATE SET
        expert_id       = EXCLUDED.expert_id,
        ucd_person_uuid = EXCLUDED.ucd_person_uuid,
        iam_id          = EXCLUDED.iam_id,
        display_name    = EXCLUDED.display_name,
        year_week       = EXCLUDED.year_week`,
      [row.email, row.expert_id, row.ucd_person_uuid, row.iam_id, row.display_name, yearWeek]
    );
  }

  // --------------------------------------------------------------------------
  // Profile record (from ae-std/person.jsonld) — vcard helpers below
  // --------------------------------------------------------------------------

  /**
   * Resolve a vcard:hasName reference to the compact { @id, @type, family,
   * given, middle, pronouns } shape ES emits.
   */
  _resolveVcardName(ref, nodeMap) {
    const node = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
      ? ref
      : nodeMap[ref?.['@id']];
    if (!node) return null;

    const out = { '@id': node['@id'] };
    const typeRaw = PgJsonld.asArray(node['@type'])[0];
    if (typeRaw) out['@type'] = PgJsonld.compactType(typeRaw);

    const family   = PgJsonld.firstValue(node, PgJsonld.URI.VCARD_FAMILY_NAME);
    const given    = PgJsonld.firstValue(node, PgJsonld.URI.VCARD_GIVEN_NAME);
    const middle   = PgJsonld.firstValue(node, PgJsonld.URI.VCARD_MIDDLE_NAME);
    const pronouns = PgJsonld.firstValue(node, PgJsonld.URI.VCARD_PRONOUNS);
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
  _resolveVcardOrgOrTitle(ref, nodeMap) {
    const node = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
      ? ref
      : nodeMap[ref?.['@id']];
    if (!node) return null;

    const out = { '@id': node['@id'] };
    const typeRaw = PgJsonld.asArray(node['@type'])[0];
    if (typeRaw) out['@type'] = PgJsonld.compactType(typeRaw);

    const name = PgJsonld.firstValue(node, PgJsonld.URI.VCARD_TITLE);
    if (name != null) out.name = name;
    return out;
  }

  /**
   * Resolve a vcard:hasURL reference list to the compact
   * [{ @id, @type, rank, url }] shape ES emits. URL @ids get the experts.ucdavis
   * base stripped; @type collapses to short form ("URL").
   */
  _resolveUrlNodes(vcardNode, nodeMap) {
    return PgJsonld.asArray(vcardNode?.[PgJsonld.URI.VCARD_HAS_URL]).map(ref => {
      const node = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
        ? ref
        : nodeMap[ref?.['@id']];
      if (!node) return null;

      const url = PgJsonld.firstValue(node, PgJsonld.URI.VCARD_URL) || node['@id'];
      if (!url) return null;

      const types = PgJsonld.asArray(node['@type'])
        .map(PgJsonld.compactType)
        .filter(Boolean);
      // ES sometimes adds a URL_<api:type> sibling; drop those — only "URL" is
      // emitted in the compacted ES response.
      const shortTypes = types.filter(t => t === 'URL');

      const out = {
        '@id': PgJsonld.stripAeBase(node['@id']),
        '@type': shortTypes.length ? shortTypes : types
      };

      const rankRaw = PgJsonld.firstValue(node, PgJsonld.URI.RANK);
      const rankNum = Number(rankRaw);
      if (Number.isFinite(rankNum)) out.rank = rankNum;

      out.url = url;
      return out;
    }).filter(Boolean);
  }

  /**
   * Normalize an ae-std person.jsonld payload (expanded JSON-LD array) into a
   * flat object holding just the fields the sitefarm API exposes. Returns
   * null when the document doesn't contain a recognizable Expert node.
   */
  normalizeAeStdPersonDoc(aeStdData) {
    if (!Array.isArray(aeStdData)) return null;

    const nodeMap = {};
    for (const node of aeStdData) {
      if (node?.['@id']) nodeMap[node['@id']] = node;
    }

    const expertNode = aeStdData.find(n =>
      PgJsonld.asArray(n['@type']).includes(PgJsonld.URI.EXPERT_TYPE)
    );
    if (!expertNode) return null;

    const orcidId      = PgJsonld.firstValue(expertNode, PgJsonld.URI.ORCID) || null;
    const researcherId = PgJsonld.firstValue(expertNode, PgJsonld.URI.RESEARCHER) || null;
    // Experts may carry multiple scopus IDs; preserve the full list. The API
    // response collapses single→scalar / multi→array to match ES output.
    const scopusIds    = PgJsonld.allValues(expertNode, PgJsonld.URI.SCOPUS);
    const overview     = PgJsonld.firstValue(expertNode, PgJsonld.URI.OVERVIEW) || null;
    const researchInterests = PgJsonld.firstValue(expertNode, PgJsonld.URI.RESEARCH_INTERESTS) || null;
    const isVisible    = PgJsonld.bool(expertNode, PgJsonld.URI.IS_VISIBLE, false);

    // Walk vcard:Individual nodes to assemble contactInfo. Sitefarm needs:
    //   - the preferred entry (isPreferred=true), and
    //   - the rank=20 (OAP) entry, which holds the website list via hasURL refs.
    const vcards = aeStdData.filter(n =>
      PgJsonld.asArray(n['@type']).includes(PgJsonld.URI.VCARD_INDIVIDUAL)
    );

    const vcardToContactBlock = (vcardNode) => {
      if (!vcardNode) return null;
      const block = {};

      // schema:name on the vcard is the formatted-display string ES emits at
      // the top of contactInfo (e.g. "Bishop, Matthew § Professor, Computer Science")
      const name = PgJsonld.firstValue(vcardNode, PgJsonld.URI.SCHEMA_NAME);
      if (name) block.name = name;

      const email = PgJsonld.firstValue(vcardNode, PgJsonld.URI.VCARD_HAS_EMAIL);
      if (email) block.hasEmail = email;

      const nameRef = PgJsonld.asArray(vcardNode[PgJsonld.URI.VCARD_HAS_NAME])[0];
      if (nameRef) {
        const resolvedName = this._resolveVcardName(nameRef, nodeMap);
        if (resolvedName) block.hasName = resolvedName;
      }

      const orgRef = PgJsonld.asArray(vcardNode[PgJsonld.URI.VCARD_HAS_ORG])[0];
      if (orgRef) {
        const org = this._resolveVcardOrgOrTitle(orgRef, nodeMap);
        if (org) block.hasOrganizationalUnit = org;
      }

      const titleRef = PgJsonld.asArray(vcardNode[PgJsonld.URI.VCARD_HAS_TITLE])[0];
      if (titleRef) {
        const title = this._resolveVcardOrgOrTitle(titleRef, nodeMap);
        if (title) block.hasTitle = title;
      }

      const urls = this._resolveUrlNodes(vcardNode, nodeMap);
      if (urls.length) block.hasURL = urls;

      return block;
    };

    const preferred = vcards.find(v => PgJsonld.bool(v, PgJsonld.URI.IS_PREFERRED, false));
    // rank=20 vcard is the OAP/CDL websites bucket per the person.js transform
    const websitesVcard = vcards.find(v =>
      Number(PgJsonld.firstValue(v, PgJsonld.URI.RANK)) === 20
    );

    // Assemble contactInfo from the preferred vcard, then layer the rank=20
    // vcard's hasURL list on top (the preferred vcard typically doesn't carry
    // websites — those live in the OAP/CDL block).
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
  buildUserProfileRecord({ metadata={}, aeStdPersonDoc=null }) {
    if (!aeStdPersonDoc) return null;
    const normalized = this.normalizeAeStdPersonDoc(aeStdPersonDoc);
    if (!normalized) return null;

    const expertId = PgJsonld.normalizeExpertId(
      normalized.expert_id_uri || metadata.expertId
    );
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

  async upsertUserProfile(client, row, yearWeek) {
    await client.query(
      `UPDATE ${this.schema}."user"
         SET orcid_id           = $2,
             researcher_id      = $3,
             scopus_ids         = $4::text[],
             overview           = $5,
             research_interests = $6,
             contact_info       = $7,
             expert_raw_payload = $8,
             year_week          = $9
       WHERE expert_id = $1`,
      [
        row.expert_id,
        row.orcid_id,
        row.researcher_id,
        Array.isArray(row.scopus_ids) && row.scopus_ids.length ? row.scopus_ids : null,
        row.overview,
        row.research_interests,
        row.contact_info,
        row.expert_raw_payload,
        yearWeek
      ]
    );
  }
}

export default ApiUser;
