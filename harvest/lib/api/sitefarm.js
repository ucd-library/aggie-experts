/**
 * SiteFarm postgres projection: works + author roles + expert profile.
 *
 * Source: ae-std/person.jsonld for the expert profile fields (handled by
 * ApiUser.buildUserProfileRecord/upsertUserProfile), and
 * ae-std/rel/{relationshipUri}.jsonld for each work the user authored.
 *
 * Target tables (all in the `api` schema):
 *   - "user"             (profile columns — managed via ApiUser)
 *   - "work"             (work master data)
 *   - work_type          (lookup, seeded by schema.sql, auto-grown if needed)
 *   - role_type          (lookup, shared with grants)
 *   - expert_work_role   (junction, with author_rank, is_favourite)
 *
 * Implementation notes on JSON-LD compaction:
 *   - publication fields use the csl:* vocabulary (NOT bibo/dcterms)
 *   - the @type list contains a schema.org type + ucdlib:Work; we surface
 *     only short forms in the API, and preserve the full URIs in `_typeUris`
 *     on the normalized doc for the work_type FK lookup
 *   - multi-vs-single value collapse follows ES JSON-LD framing: scalar if
 *     one, array if many. PgJsonld.collapse handles this.
 *
 * Usage:
 *   const sitefarm = new SitefarmApi();
 *   await sitefarm.load({ user, metadata, files });
 *   await sitefarm.purge(expertId);
 */

import { logger, getYearWeek } from '@ucd-lib/experts-commons';
import PgClient from '../pg-client.js';
import PgJsonld from '../pg-jsonld.js';
import ApiUser from './user.js';

class SitefarmApi {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.schema='api']
   */
  constructor({ schema = PgJsonld.SCHEMA_NAME } = {}) {
    PgJsonld.assertSchemaName(schema);
    this.schema = schema;
    this.user = new ApiUser({ schema });
  }

  // --------------------------------------------------------------------------
  // ae-std → webapp-shape work doc normalizer
  // --------------------------------------------------------------------------

  /**
   * Resolve a single csl:author reference into the compact { @id, given,
   * family, rank } object that the ES sitefarm path returns.
   */
  _resolveAuthorRef(ref, nodeMap) {
    const authorNode = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
      ? ref
      : nodeMap[ref?.['@id']];
    if (!authorNode) return null;

    const out = { '@id': authorNode['@id'] };

    const family = PgJsonld.firstValue(authorNode, PgJsonld.URI.CSL_FAMILY);
    const given  = PgJsonld.firstValue(authorNode, PgJsonld.URI.CSL_GIVEN);
    if (family != null) out.family = family;
    if (given  != null) out.given  = given;

    const rankRaw = PgJsonld.firstValue(authorNode, PgJsonld.URI.RANK);
    const rankNum = Number(rankRaw);
    if (Number.isFinite(rankNum)) out.rank = rankNum;

    return out;
  }

  /**
   * Resolve a vivo:hasPublicationVenue reference to the compact
   * {@id, issn, name} shape ES emits.
   */
  _resolveVenueRef(ref, nodeMap) {
    const node = (ref && typeof ref === 'object' && Object.keys(ref).length > 1)
      ? ref
      : nodeMap[ref?.['@id']];
    if (!node) return null;

    const out = { '@id': PgJsonld.stripAeBase(node['@id']) };
    const issn = PgJsonld.firstValue(node, PgJsonld.URI.VIVO_ISSN);
    const name = PgJsonld.firstValue(node, PgJsonld.URI.SCHEMA_NAME);
    if (issn) out.issn = issn;
    if (name) out.name = name;
    return out;
  }

  /**
   * Normalize an ae-std work relationship document (rel/*.jsonld). Returns the
   * compacted `{ '@graph': [workNode], _typeUris: [...] }` shape that
   * buildWorkRecord/buildWorkRoles understand.
   */
  normalizeAeStdWorkDoc(aeStdData) {
    if (!Array.isArray(aeStdData)) return aeStdData;

    const nodeMap = {};
    for (const node of aeStdData) {
      if (node?.['@id']) nodeMap[node['@id']] = node;
    }

    // Identify the publication node by its custom Work type.
    const workNode = aeStdData.find(n =>
      PgJsonld.asArray(n['@type']).includes(PgJsonld.URI.WORK_TYPE)
    );
    if (!workNode) return null;

    // relatedBy: pull each Authorship node.
    const relatedBy = PgJsonld.asArray(workNode[PgJsonld.URI.RELATED_BY]).map(ref => {
      const roleNode = (ref && Object.keys(ref).length > 1) ? ref : nodeMap[ref?.['@id']];
      if (!roleNode) return { '@id': ref?.['@id'] };

      const relates = PgJsonld.asArray(roleNode[PgJsonld.URI.RELATES])
        .map(r => PgJsonld.stripAeBase(r?.['@id'] || r))
        .filter(Boolean);

      return {
        '@id': roleNode['@id'],
        '@type': PgJsonld.asArray(roleNode['@type']).map(PgJsonld.compactType),
        relates,
        'is-visible': PgJsonld.bool(roleNode, PgJsonld.URI.IS_VISIBLE, false),
        'ucdlib:favourite': PgJsonld.bool(roleNode, PgJsonld.URI.FAVOURITE, false),
        rank: Number(PgJsonld.firstValue(roleNode, PgJsonld.URI.RANK)) || null
      };
    });

    // author: resolve each csl:author ref. Sort by rank.
    const authors = PgJsonld.asArray(workNode[PgJsonld.URI.CSL_AUTHOR])
      .map(ref => this._resolveAuthorRef(ref, nodeMap))
      .filter(Boolean)
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

    // @type: short forms for the API; full URIs preserved in _typeUris for
    // the work_type FK lookup.
    const rawTypeUris = PgJsonld.asArray(workNode['@type']).filter(t => typeof t === 'string');
    const shortTypes = Array.from(new Set(rawTypeUris.map(PgJsonld.compactType).filter(Boolean)));

    // hasPublicationVenue: separate node referenced from the publication.
    const venueRef = PgJsonld.asArray(workNode[PgJsonld.URI.HAS_PUBLICATION_VENUE])[0];
    const venue = venueRef ? this._resolveVenueRef(venueRef, nodeMap) : null;

    return {
      '@graph': [{
        '@id':                workNode['@id'],
        '@type':              shortTypes,
        title:                PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_TITLE) ?? null,
        issued:               PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_ISSUED) ?? null,
        'container-title':    PgJsonld.collapse(workNode, PgJsonld.URI.CSL_CONTAINER),
        volume:               PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_VOLUME) ?? null,
        page:                 PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_PAGE) ?? null,
        issue:                PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_ISSUE) ?? null,
        publisher:            PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_PUBLISHER) ?? null,
        DOI:                  PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_DOI) ?? null,
        abstract:             PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_ABSTRACT) ?? null,
        status:               PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_STATUS) ?? null,
        type:                 PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_TYPE) ?? null,
        // csl:date-available has no named term in the webapp JSON-LD context;
        // ES emits it under the prefixed name "cite:date-available".
        'cite:date-available': PgJsonld.firstValue(workNode, PgJsonld.URI.CSL_DATE_AVAILABLE) ?? null,
        ISBN:                 PgJsonld.collapse(workNode, PgJsonld.URI.CSL_ISBN),
        ISSN:                 PgJsonld.collapse(workNode, PgJsonld.URI.CSL_ISSN),
        eissn:                PgJsonld.collapse(workNode, PgJsonld.URI.CSL_EISSN),
        'collection-number':  PgJsonld.collapse(workNode, PgJsonld.URI.CSL_COLLECTION_NUM),
        language:             PgJsonld.collapse(workNode, PgJsonld.URI.CSL_LANGUAGE),
        license:              PgJsonld.collapse(workNode, PgJsonld.URI.CSL_LICENSE),
        medium:               PgJsonld.collapse(workNode, PgJsonld.URI.CSL_MEDIUM),
        note:                 PgJsonld.collapse(workNode, PgJsonld.URI.CSL_NOTE),
        url:                  PgJsonld.collapse(workNode, PgJsonld.URI.CSL_URL),
        hasPublicationVenue:  venue,
        author:               authors.length ? authors : null,
        relatedBy
      }],
      // Internal field — not part of the API response. buildWorkRecord pulls
      // this out for the work_type FK lookup so the API @type can stay short.
      _typeUris: rawTypeUris
    };
  }

  // --------------------------------------------------------------------------
  // Work builders (read a compacted/webapp-shape work doc)
  // --------------------------------------------------------------------------

  _getWorkNode(workDoc={}) {
    return PgJsonld.asArray(workDoc['@graph']).find(node => {
      const types = PgJsonld.asArray(node?.['@type']);
      return types.includes('Work') || types.includes(PgJsonld.URI.WORK_TYPE);
    }) || null;
  }

  buildWorkRecord(workDoc={}) {
    const workNode = this._getWorkNode(workDoc);
    if (!workNode?.['@id']) return null;

    const issuedRaw = workNode.issued || null;

    // Prefer the normalizer-supplied _typeUris (full URIs) for the work_type
    // lookup; fall back to whatever's in @type if absent.
    const typeUris = PgJsonld.asArray(workDoc._typeUris).filter(t => typeof t === 'string').length
      ? workDoc._typeUris
      : PgJsonld.asArray(workNode['@type']).filter(t => typeof t === 'string');

    return {
      work_id:         workNode['@id'],
      title:           workNode.title || workNode.name || null,
      issued:          issuedRaw,
      issued_date:     PgJsonld.partialDateToFull(issuedRaw),
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

  buildWorkRoles(workDoc={}) {
    const workNode = this._getWorkNode(workDoc);
    if (!workNode) return [];

    return PgJsonld.asArray(workNode.relatedBy)
      .map(role => {
        const roleId = role?.['@id'];
        if (!roleId) return null;

        return {
          role_id:       roleId,
          work_id:       workNode['@id'],
          expert_id:     PgJsonld.normalizeExpertId(PgJsonld.getExpertIdFromRole(role)),
          role_type_uri: PgJsonld.pickRoleType(role),
          is_visible:    role?.['is-visible'] === true,
          is_favourite:  role?.['ucdlib:favourite'] === true,
          author_rank:   Number.isInteger(role?.rank) ? role.rank : null,
          raw_payload:   role
        };
      })
      .filter(Boolean)
      .filter(role => role.work_id && role.role_id);
  }

  // --------------------------------------------------------------------------
  // Upserts
  // --------------------------------------------------------------------------

  async upsertWork(client, row, yearWeek) {
    // Seed any new work types we haven't seen before.
    for (const workTypeUri of row.work_type_uris) {
      if (workTypeUri) {
        await client.query(
          `INSERT INTO ${this.schema}.work_type (uri, label)
           VALUES ($1, $1)
           ON CONFLICT (uri) DO NOTHING`,
          [workTypeUri]
        );
      }
    }

    await client.query(
      `INSERT INTO ${this.schema}."work"
        (work_id, title, issued, issued_date, container_title, volume, page, doi,
         abstract, status, raw_payload, work_type_ids, year_week)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         ARRAY(SELECT work_type_id FROM ${this.schema}.work_type WHERE uri = ANY($12::text[])),
         $13)
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
        year_week       = EXCLUDED.year_week`,
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
        row.work_type_uris,
        yearWeek
      ]
    );
  }

  async replaceWorkRoles(client, workId, roles) {
    await client.query(`DELETE FROM ${this.schema}.expert_work_role WHERE work_id = $1`, [workId]);

    for (const role of roles) {
      if (role.role_type_uri) {
        await client.query(
          `INSERT INTO ${this.schema}.role_type (uri, label)
           VALUES ($1, $1)
           ON CONFLICT (uri) DO NOTHING`,
          [role.role_type_uri]
        );
      }
    }

    for (const role of roles) {
      await client.query(
        `INSERT INTO ${this.schema}.expert_work_role
          (role_id, work_id, expert_id, role_type_id, is_visible, is_favourite,
           author_rank, raw_payload)
         VALUES ($1, $2, $3,
           (SELECT role_type_id FROM ${this.schema}.role_type WHERE uri = $4),
           $5, $6, $7, $8)
         ON CONFLICT (role_id)
         DO UPDATE SET
          work_id      = EXCLUDED.work_id,
          expert_id    = EXCLUDED.expert_id,
          role_type_id = EXCLUDED.role_type_id,
          is_visible   = EXCLUDED.is_visible,
          is_favourite = EXCLUDED.is_favourite,
          author_rank  = EXCLUDED.author_rank,
          raw_payload  = EXCLUDED.raw_payload`,
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

  // --------------------------------------------------------------------------
  // Public entry points
  // --------------------------------------------------------------------------

  /**
   * Load the sitefarm projection (expert profile + works) into postgres for a
   * single user. Mirrors MivApi.load but reads expert fields from
   * ae-std/person.jsonld and walks the work files passed in.
   *
   * Expects `files` to contain a `personAeStd` entry (path to
   * ae-std/person.jsonld) and zero or more `work` entries (paths to
   * ae-std/rel/{relationshipUri}.jsonld).
   */
  async load({ user, metadata={}, files=[] }) {
    const pgClient = new PgClient();
    const personFile = files.find(file => file.type === 'personAeStd');
    const workFiles  = files.filter(file => file.type === 'work');

    // The "user" row is upserted by MivApi.load before we run; we just
    // overlay profile fields here. If the row doesn't exist yet, the UPDATE
    // is a no-op and we'll catch the user on the next pass.
    let userProfileRecord = null;
    if (personFile?.path) {
      const personDoc = await PgJsonld.readJson(personFile.path);
      userProfileRecord = this.user.buildUserProfileRecord({
        metadata,
        aeStdPersonDoc: personDoc
      });
    }

    if (!userProfileRecord?.expert_id) {
      logger.warn({ user }, 'Sitefarm postgres load: missing ae-std person doc or expert_id; skipping profile update');
    }

    const yearWeek = getYearWeek({allValues: true, asString: true}).yearWeek;

    try {
      await pgClient.query('BEGIN');

      if (userProfileRecord?.expert_id) {
        await this.user.upsertUserProfile(pgClient, userProfileRecord, yearWeek);
      }

      for (const file of workFiles) {
        let workDoc = await PgJsonld.readJson(file.path);
        if (!workDoc) continue;

        // ae-std rel files are JSON arrays; normalize first.
        if (Array.isArray(workDoc)) {
          workDoc = this.normalizeAeStdWorkDoc(workDoc);
          if (!workDoc) continue;
        }

        const workRecord = this.buildWorkRecord(workDoc);
        if (!workRecord?.work_id) continue;

        await this.upsertWork(pgClient, workRecord, yearWeek);
        await this.replaceWorkRoles(pgClient, workRecord.work_id, this.buildWorkRoles(workDoc));
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

  async purge(expertId) {
    if (!expertId) return;

    const pgClient = new PgClient();
    const normalizedExpertId = PgJsonld.normalizeExpertId(expertId);
    if (!normalizedExpertId) return;

    try {
      await pgClient.query('BEGIN');

      // Remove this expert's roles, then orphaned works.
      await pgClient.query(
        `DELETE FROM ${this.schema}.expert_work_role WHERE expert_id = $1`,
        [normalizedExpertId]
      );
      await pgClient.query(
        `DELETE FROM ${this.schema}."work" w
         WHERE NOT EXISTS (
           SELECT 1 FROM ${this.schema}.expert_work_role wr WHERE wr.work_id = w.work_id
         )`
      );

      // Clear sitefarm-specific profile columns. Identity columns are
      // managed by MivApi.purge.
      await pgClient.query(
        `UPDATE ${this.schema}."user"
           SET orcid_id           = NULL,
               researcher_id      = NULL,
               scopus_ids         = NULL,
               overview           = NULL,
               research_interests = NULL,
               contact_info       = NULL,
               expert_raw_payload = NULL
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
}

export default SitefarmApi;
