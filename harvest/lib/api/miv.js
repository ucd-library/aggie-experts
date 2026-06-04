/**
 * MIV postgres projection: grants + roles.
 *
 * Source: ae-std/rel/{relationshipUri}.jsonld for each grant the user has a
 * role on, plus webapp/expert.jsonld for the user identity.
 *
 * Target tables (all in the `api` schema):
 *   - "user"             (identity columns only — managed via ApiUser)
 *   - "grant"            (grant master data)
 *   - grant_type         (lookup, seeded by schema.sql, auto-grown if needed)
 *   - role_type          (lookup, shared with works)
 *   - expert_grant_role  (junction)
 *
 * Usage:
 *   const miv = new MivApi();
 *   await miv.load({ user, metadata, files });
 *   await miv.purge(expertId);
 */

import { logger, getYearWeek } from '@ucd-lib/experts-commons';
import PgClient from '../pg-client.js';
import PgJsonld from '../pg-jsonld.js';
import ApiUser from './user.js';

class MivApi {
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
  // Grant builders (read a compacted/webapp-shape grant doc)
  // --------------------------------------------------------------------------

  _getGrantNode(grantDoc={}) {
    return PgJsonld.asArray(grantDoc['@graph'])
      .find(node => PgJsonld.hasType(node, 'Grant')) || null;
  }

  buildGrantRecord(grantDoc={}) {
    const grantNode = this._getGrantNode(grantDoc);
    if (!grantNode?.['@id']) return null;

    return {
      grant_id: grantNode['@id'],
      title: PgJsonld.trimGrantTitle(grantNode.name) || grantNode.name || grantNode.title || null,
      sponsor_id: grantNode.sponsorAwardId || null,
      sponsor_name: grantNode?.assignedBy?.name || null,
      total_award_amount: PgJsonld.toNumberOrNull(grantNode.totalAwardAmount),
      start_date: PgJsonld.toDateOrNull(grantNode?.dateTimeInterval?.start?.dateTime),
      end_date: PgJsonld.toDateOrNull(grantNode?.dateTimeInterval?.end?.dateTime),
      status: grantNode.status || null,
      raw_payload: grantNode,
      grant_type_uris: PgJsonld.asArray(grantNode['@type']).filter(t => typeof t === 'string')
    };
  }

  buildGrantRoles(grantDoc={}) {
    const grantNode = this._getGrantNode(grantDoc);
    if (!grantNode) return [];

    return PgJsonld.asArray(grantNode.relatedBy)
      .map(role => {
        const roleId = role?.['@id'];
        if (!roleId) return null;

        return {
          role_id: roleId,
          grant_id: grantNode['@id'],
          expert_id: PgJsonld.normalizeExpertId(PgJsonld.getExpertIdFromRole(role)),
          role_type_uri: PgJsonld.pickRoleType(role),
          is_visible: role?.['is-visible'] === true
        };
      })
      .filter(Boolean)
      .filter(role => role.grant_id && role.role_type_uri);
  }

  // --------------------------------------------------------------------------
  // ae-std → webapp-shape grant doc normalizer
  // --------------------------------------------------------------------------

  /**
   * Convert an ae-std expanded JSON-LD array (from ae-std/rel/*.jsonld) into
   * the compacted `{ '@graph': [grantNode] }` shape that buildGrantRecord /
   * buildGrantRoles expect, resolving all internal @id references along the way.
   *
   * If the input is already an object (e.g. a webapp-format grant doc from a
   * regenerated disassociated work), it is returned unchanged so the caller
   * can handle both formats.
   */
  normalizeAeStdGrantDoc(aeStdData) {
    if (!Array.isArray(aeStdData)) return aeStdData;

    const nodeMap = {};
    for (const node of aeStdData) {
      if (node?.['@id']) nodeMap[node['@id']] = node;
    }

    const grantNode = aeStdData.find(n =>
      PgJsonld.asArray(n['@type']).includes(PgJsonld.URI.GRANT_TYPE)
    );
    if (!grantNode) return null;

    // assignedBy (funder node)
    const assignedById = PgJsonld.asArray(grantNode[PgJsonld.URI.ASSIGNED_BY])[0]?.['@id'];
    const assignedByNode = assignedById ? nodeMap[assignedById] : null;
    const assignedBy = assignedByNode
      ? {
          '@id': assignedByNode['@id'],
          '@type': PgJsonld.toShortType(PgJsonld.asArray(assignedByNode['@type'])[0]),
          name: PgJsonld.firstValue(assignedByNode, PgJsonld.URI.SCHEMA_NAME)
        }
      : undefined;

    // dateTimeInterval -> start / end date nodes
    const intervalId = PgJsonld.asArray(grantNode[PgJsonld.URI.DATE_TIME_INTERVAL])[0]?.['@id'];
    const intervalNode = intervalId ? nodeMap[intervalId] : null;
    let dateTimeInterval;
    if (intervalNode) {
      const startId = PgJsonld.asArray(intervalNode[PgJsonld.URI.DATE_TIME_START])[0]?.['@id'];
      const endId   = PgJsonld.asArray(intervalNode[PgJsonld.URI.DATE_TIME_END])[0]?.['@id'];
      const startNode = startId ? nodeMap[startId] : null;
      const endNode   = endId   ? nodeMap[endId]   : null;
      dateTimeInterval = {
        '@id': intervalNode['@id'],
        start: startNode ? {
          '@id': startNode['@id'],
          dateTime: PgJsonld.firstValue(startNode, PgJsonld.URI.DATE_TIME),
          dateTimePrecision: PgJsonld.toShortPrecision(PgJsonld.firstValue(startNode, PgJsonld.URI.DATE_TIME_PRECISION))
        } : undefined,
        end: endNode ? {
          '@id': endNode['@id'],
          dateTime: PgJsonld.firstValue(endNode, PgJsonld.URI.DATE_TIME),
          dateTimePrecision: PgJsonld.toShortPrecision(PgJsonld.firstValue(endNode, PgJsonld.URI.DATE_TIME_PRECISION))
        } : undefined
      };
    }

    // relatedBy role refs (some may be inline objects, some just { @id } refs)
    const relatedBy = PgJsonld.asArray(grantNode[PgJsonld.URI.RELATED_BY]).map(ref => {
      const roleNode = (Object.keys(ref).length > 1) ? ref : nodeMap[ref['@id']];
      if (!roleNode) return { '@id': ref['@id'] };

      const roleName = PgJsonld.firstValue(roleNode, PgJsonld.URI.SCHEMA_NAME);
      const inheresInId = PgJsonld.asArray(roleNode[PgJsonld.URI.RO_INHERES_IN])[0]?.['@id'];
      const inheresIn = inheresInId ? PgJsonld.stripAeBase(inheresInId) : undefined;

      const relates = PgJsonld.asArray(roleNode[PgJsonld.URI.RELATES])
        .map(r => PgJsonld.stripAeBase(r['@id'] || r))
        .filter(Boolean);

      return {
        '@id': roleNode['@id'],
        '@type': PgJsonld.asArray(roleNode['@type']).map(PgJsonld.toShortType),
        name: roleName,
        inheres_in: inheresIn,
        relates,
        'is-visible': PgJsonld.bool(roleNode, PgJsonld.URI.IS_VISIBLE, false)
      };
    });

    const rawIdentifiers = PgJsonld.asArray(grantNode[PgJsonld.URI.SCHEMA_IDENTIFIER]);
    const identifier = Array.from(new Set(rawIdentifiers
      .map(item => item?.['@id'] ?? item?.['@value'] ?? item)
      .filter(value => typeof value === 'string' && value.trim())
      .map(value => value.trim())));

    const rawTypes = PgJsonld.asArray(grantNode['@type']);
    const shortTypes = rawTypes.map(PgJsonld.toShortType);
    // Sort "Grant" to the end so the specific subtype (Grant_Research, …) wins
    const normalizedTypes = Array.from(new Set(shortTypes.filter(Boolean))).sort((a, b) => {
      if (a === 'Grant') return 1;
      if (b === 'Grant') return -1;
      return 0;
    });

    return {
      '@graph': [{
        '@id':            grantNode['@id'],
        '@type':          normalizedTypes,
        identifier,
        name:             PgJsonld.firstValue(grantNode, PgJsonld.URI.SCHEMA_NAME),
        sponsorAwardId:   PgJsonld.firstValue(grantNode, PgJsonld.URI.SPONSOR_AWARD_ID),
        totalAwardAmount: PgJsonld.firstValue(grantNode, PgJsonld.URI.TOTAL_AWARD_AMOUNT),
        status:           PgJsonld.firstValue(grantNode, PgJsonld.URI.CSL_STATUS),
        assignedBy,
        dateTimeInterval,
        relatedBy
      }]
    };
  }

  // --------------------------------------------------------------------------
  // Upserts
  // --------------------------------------------------------------------------

  async upsertGrant(client, row, yearWeek) {
    // Seed any new grant types we haven't seen before.
    for (const grantTypeUri of row.grant_type_uris) {
      if (grantTypeUri) {
        await client.query(
          `INSERT INTO ${this.schema}.grant_type (uri, label)
           VALUES ($1, $1)
           ON CONFLICT (uri) DO NOTHING`,
          [grantTypeUri]
        );
      }
    }

    await client.query(
      `INSERT INTO ${this.schema}."grant"
        (grant_id, title, sponsor_id, sponsor_name, total_award_amount,
         start_date, end_date, status, raw_payload, grant_type_ids, year_week)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
         ARRAY(SELECT grant_type_id FROM ${this.schema}.grant_type WHERE uri = ANY($10::text[])),
         $11)
       ON CONFLICT (grant_id)
       DO UPDATE SET
        title              = EXCLUDED.title,
        sponsor_id         = EXCLUDED.sponsor_id,
        sponsor_name       = EXCLUDED.sponsor_name,
        total_award_amount = EXCLUDED.total_award_amount,
        start_date         = EXCLUDED.start_date,
        end_date           = EXCLUDED.end_date,
        status             = EXCLUDED.status,
        raw_payload        = EXCLUDED.raw_payload,
        grant_type_ids     = EXCLUDED.grant_type_ids,
        year_week          = EXCLUDED.year_week`,
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
        row.grant_type_uris,
        yearWeek
      ]
    );
  }

  async replaceGrantRoles(client, grantId, roles, expertId) {
    // Delete this expert's roles and any orphaned rows with no expert linkage
    // (NULL expert_id), which come from old-style harvests before proper
    // inheres_in mapping.
    await client.query(
      `DELETE FROM ${this.schema}.expert_grant_role
       WHERE grant_id = $1 AND (expert_id = $2 OR expert_id IS NULL)`,
      [grantId, expertId]
    );

    // Seed any new role types.
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
        `INSERT INTO ${this.schema}.expert_grant_role
          (role_id, grant_id, expert_id, role_type_id, is_visible)
         VALUES ($1, $2, $3,
           (SELECT role_type_id FROM ${this.schema}.role_type WHERE uri = $4),
           $5)
         ON CONFLICT (role_id)
         DO UPDATE SET
          grant_id     = EXCLUDED.grant_id,
          expert_id    = EXCLUDED.expert_id,
          role_type_id = EXCLUDED.role_type_id,
          is_visible   = EXCLUDED.is_visible`,
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

  // --------------------------------------------------------------------------
  // Public entry points
  // --------------------------------------------------------------------------

  /**
   * Load the MIV projection (user identity + grants + roles) into postgres
   * for a single user.
   */
  async load({ user, metadata={}, files=[] }) {
    const pgClient = new PgClient();
    const expertFile = files.find(file => file.type === 'expert');
    const grantFiles = files.filter(file => file.type === 'grant');

    const expertDoc = await PgJsonld.readJson(expertFile?.path);
    const userRecord = this.user.buildUserRecord({ user, metadata, expertDoc });

    if (!userRecord?.expert_id || !userRecord?.email) {
      logger.warn({ user }, 'MIV postgres load skipped - missing user/expert identity');
      await pgClient.end();
      return;
    }

    const yearWeek = getYearWeek({allValues: true, asString: true}).yearWeek;

    try {
      await pgClient.query('BEGIN');

      await this.user.upsertUser(pgClient, userRecord, yearWeek);

      for (const file of grantFiles) {
        let grantDoc = await PgJsonld.readJson(file.path);
        if (!grantDoc) continue;

        // ae-std rel files are JSON arrays; normalize first.
        if (Array.isArray(grantDoc)) {
          grantDoc = this.normalizeAeStdGrantDoc(grantDoc);
          if (!grantDoc) continue;
        }

        const grantRecord = this.buildGrantRecord(grantDoc);
        if (!grantRecord?.grant_id) continue;

        await this.upsertGrant(pgClient, grantRecord, yearWeek);
        await this.replaceGrantRoles(
          pgClient,
          grantRecord.grant_id,
          this.buildGrantRoles(grantDoc),
          userRecord.expert_id
        );
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

  async purge(expertId) {
    if (!expertId) return;

    const pgClient = new PgClient();
    const normalizedExpertId = PgJsonld.normalizeExpertId(expertId);
    if (!normalizedExpertId) return;

    try {
      await pgClient.query('BEGIN');

      await pgClient.query(
        `DELETE FROM ${this.schema}.expert_grant_role WHERE expert_id = $1`,
        [normalizedExpertId]
      );

      // Remove orphaned grants (no more roles point at them)
      await pgClient.query(
        `DELETE FROM ${this.schema}."grant" g
         WHERE NOT EXISTS (
           SELECT 1 FROM ${this.schema}.expert_grant_role gr WHERE gr.grant_id = g.grant_id
         )`
      );

      // Clear identity columns. Profile columns are managed by SitefarmApi.purge.
      await pgClient.query(
        `UPDATE ${this.schema}."user"
         SET expert_id       = NULL,
             ucd_person_uuid = NULL,
             iam_id          = NULL,
             display_name    = NULL
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
}

export default MivApi;
