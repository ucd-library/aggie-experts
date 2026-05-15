import cache from '../cache.js';
import { logger, config, Elasticsearch } from '@ucd-lib/experts-commons';
import { loadFiles as loadEs, getUsersCurrentScholarlyWorks } from './elastic-search/index.js';
import { generateScholarlyWork } from '../transform/webapp/scholary-work.js';
import {
  loadMivPostgres,
  purgeMivPostgresExpert,
  loadSitefarmPostgres,
  purgeSitefarmPostgresExpert
} from '../reporting/index.js';

async function run(user, alias) {
  if( !alias ) alias = config.elasticsearch.aliases.stage;

  // check which aliases to write to.  ALL means both stage & current
  if( alias === 'all' ) {
    alias = [config.elasticsearch.aliases.stage, config.elasticsearch.aliases.current];
  } else {
    alias = [alias]
  }

  let metadata = JSON.parse(await cache.readUserAsset(user, 'metadata.json'));

  // Insert load statistics on scholarly output into database if reporting is enabled
  if (config.reporting.enabled && config.postgres.client) {
    await reportScholarlyOutputLoadStats(user, metadata);
    await reportValidationIssues(user, metadata);
  }

  if( metadata.isPublic === false ) {
    logger.warn(`User ${user} is marked as not public, skipping load.`);

    await purgeUser(metadata.expertId, alias);
    await purgeMivPostgresExpert('expert/'+metadata.expertId);
    await purgeSitefarmPostgresExpert('expert/'+metadata.expertId);

    if (config.reporting.enabled && config.postgres.client && 
        alias.includes(config.elasticsearch.aliases.stage) ) {
      await config.postgres.client.setEsStageInsertedAt(user, null);
    }
    return;
  }


  // find all users scholarly work files (expert file, works, grants) for loading into elastic search
  let files = await getPublicScholarlyWorkFiles(user);

  // get current works, see if anything is elasticsearch is not in current list
  // if so we need to re transform and reload into elastic search
  // the user may have disassociated work from their profile
  let currentWorks = await getUsersCurrentScholarlyWorks('expert/'+metadata.expertId, 'work', alias);
  let currentGrants = await getUsersCurrentScholarlyWorks('expert/'+metadata.expertId, 'grant', alias);

  let currentScholarlyWorks = new Set([...currentWorks, ...currentGrants]);
  let newScholarlyWorks = new Set(files
    .filter(file => file.type !== 'expert') 
    .map(file => file.uri)
  );

  let disassociatedWorks = [...currentScholarlyWorks].filter(uri => !newScholarlyWorks.has(uri));
  if( disassociatedWorks.length > 0 ) {
    logger.info(`Found ${disassociatedWorks.length} scholarly works that need to be transformed and reloaded into elastic search for user ${user}`, {disassociatedWorks});
    for( let uri of disassociatedWorks ) {
      // TODO: this kinda sucks
      let type = currentWorks.includes(uri) ? 'work' : 'grant';
      try {
        let result = await generateScholarlyWork(uri, {write: true});
        files.push({
          type,
          path: result.filepath
        });
      } catch (error) {
        logger.error(`Failed to generate scholarly work for URI ${uri}: ${error.message}`);
      }
    }
  }

  // load MIV projection into postgres from transformed public expert/grant files
  const mivFiles = getMivPostgresFiles(user, files);
  await loadMivPostgres({
    user,
    metadata,
    files: mivFiles
  });

  // load Sitefarm projection (expert profile + works) into postgres from ae-std docs.
  // Runs after loadMivPostgres so the "user" row exists for the profile overlay.
  const sitefarmFiles = getSitefarmPostgresFiles(user, files);
  await loadSitefarmPostgres({
    user,
    metadata,
    files: sitefarmFiles
  });

  // load files into elastic search
  let indexes = await loadEs(files, alias);

  if (config.reporting.enabled && config.postgres.client && 
      alias.includes(config.elasticsearch.aliases.stage) ) {
    await config.postgres.client.setEsStageInsertedAt(user, new Date());
  }
  
  logger.info(`Loaded data into elastic search for user: ${user}`);

  return indexes;
}

async function reportScholarlyOutputLoadStats(user, metadata) {
  if( !metadata.works ) metadata.works = [];
  if( !metadata.grants ) metadata.grants = [];

  let workStats = [
    {
      type: 'works',
      visibility: 'public',
      count: metadata.works.filter(work => work.privacy.value === true).length
    },
    {
      type: 'works',
      visibility: 'private',
      count: metadata.works.filter(work => work.privacy.value === false).length
    }
  ];

  let grantStats = [
    {
      type: 'grants',
      visibility: 'public',
      count: metadata.grants.filter(grant => grant.privacy.value === true).length
    },
    {
      type: 'grants',
      visibility: 'private',
      count: metadata.grants.filter(grant => grant.privacy.value === false).length
    }
  ];

  for (let stat of [...workStats, ...grantStats]) {
    await config.postgres.client.insertUserScholarlyOutputLoadStats({
      command_id: config.reporting.commandId,
      user_id: user,
      type: stat.type,
      visibility: stat.visibility,
      count: stat.count
    });
  }
  logger.info(`Recorded load statistics for user: ${user}`, { workStats, grantStats });
}

function _asArray(val) {
  if( val === undefined || val === null ) return [];
  return Array.isArray(val) ? val : [val];
}

function _hasType(node, type) {
  const t = _asArray(node?.['@type']);
  return t.includes(type);
}

/**
 * @description Persist field-level validation issues for works/grants into Postgres.
 * Source of truth for field validation is the webapp expert.jsonld output
 */
async function reportValidationIssues(user, metadata={}) {
  const pg = config.postgres?.client;
  if( !config.reporting.enabled || !pg ) return;

  const commandId = config.reporting.commandId;

  // expert.jsonld is generated in transform and should exist before load.
  // If it doesn't, we avoid writing noisy false positives.
  let expertDoc;
  try {
    expertDoc = JSON.parse(await cache.readUserAsset(user, 'webapp/expert.jsonld'));
  } catch (e) {
    logger.warn(`Unable to read webapp/expert.jsonld for validation issue reporting for user ${user}. Skipping.`, { error: e.message });
    return;
  }

  const graph = _asArray(expertDoc['@graph']);
  const issues = [];

  // Works
  for( const node of graph.filter(n => _hasType(n, 'Work')) ) {
    const entityId = node?.['@id'];
    if( !entityId ) continue;

    const title = node?.title;
    const issued = node?.issued;

    if( typeof title !== 'string' || !title.trim() ) {
      issues.push({
        entity_type: 'work',
        entity_id: entityId,
        issue_type: 'invalid_type',
        field: 'title',
        message: 'Invalid work title, expected non-empty string'
      });
    }

    if( typeof issued !== 'string' || !issued.trim() ) {
      issues.push({
        entity_type: 'work',
        entity_id: entityId,
        issue_type: 'invalid_type',
        field: 'issued',
        message: 'Invalid work issued, expected non-empty string'
      });
    }

    const issue = node?.issue;
    if( issue !== undefined && typeof issue !== 'string' ) {
      issues.push({
        entity_type: 'work',
        entity_id: entityId,
        issue_type: 'invalid_type',
        field: 'issue',
        message: 'Invalid work issue, expected string when present'
      });
    }
  }

  // Grants
  for( const node of graph.filter(n => _hasType(n, 'Grant')) ) {
    const entityId = node?.['@id'];
    if( !entityId ) continue;

    const name = node?.name;
    const endDate = node?.dateTimeInterval?.end?.dateTime;

    if( typeof name !== 'string' || !name.trim() ) {
      issues.push({
        entity_type: 'grant',
        entity_id: entityId,
        issue_type: 'invalid_type',
        field: 'name',
        message: 'Invalid grant name, expected non-empty string'
      });
    }

    if( endDate !== undefined && (typeof endDate !== 'string' || isNaN(new Date(endDate).valueOf())) ) {
      issues.push({
        entity_type: 'grant',
        entity_id: entityId,
        issue_type: 'invalid_value',
        field: 'dateTimeInterval.end.dateTime',
        message: 'Invalid grant end date, expected ISO date string parseable by Date()'
      });
    }
  }

  // Expert-level visibility flags
  const expertEntityId = `expert/${metadata.expertId}`;
  const odrNameWwwFlag = metadata.odrPrivacy?.nameWwwFlag;
  if (odrNameWwwFlag == null) {
    issues.push({
      entity_type: 'expert',
      entity_id: expertEntityId,
      issue_type: 'missing_value',
      field: 'odrPrivacy.nameWwwFlag',
      message: 'IAM nameWwwFlag is absent; expert treated as visible by default'
    });
  } else if (odrNameWwwFlag !== 'Y' && odrNameWwwFlag !== 'N') {
    issues.push({
      entity_type: 'expert',
      entity_id: expertEntityId,
      issue_type: 'invalid_value',
      field: 'odrPrivacy.nameWwwFlag',
      message: `Unexpected IAM nameWwwFlag value: "${odrNameWwwFlag}"`
    });
  }

  if( !issues.length ) return;

  for( const issue of issues ) {
    await pg.insertValidationIssue({
      command_id: commandId,
      user_id: user,
      ...issue
    });
  }

  logger.info(`Recorded validation issues for user: ${user}`, { count: issues.length });
}

async function purgeUser(expertId, alias='stage') {
  logger.info(`Purging scholarly works for user with expertId ${expertId} from elastic search index with alias ${alias}`);

  if( !Array.isArray(alias) ) {
    alias = [alias];
  }

  for( let a of alias ) {
    // Delete document associated with the user
    let deleteResp = await Elasticsearch.deleteDocument('experts-'+a, 'expert/'+expertId);
    logger.info('Delete response for expert document:', {deleteResp});

    // get current works
    let current = {
      work : await getUsersCurrentScholarlyWorks('expert/'+expertId, 'work', a),
      grant : await getUsersCurrentScholarlyWorks('expert/'+expertId, 'grant', a)
    }

    for( let type in current ) {
      let works = current[type];
      for( let uri of works ) {
        try {
          await generateScholarlyWork(uri, {write: true});
        } catch (error) {
          logger.error(`Failed to generate scholarly work for URI ${uri}: ${error.message}`);
        }
      }
    }
  }
}

async function getPublicScholarlyWorkFiles(user) {
  const list = JSON.parse(await cache.readUserAsset(user, 'metadata.json'));

  let results = [
    {
      type: 'expert',
      path: cache.getUserPath(user, ['webapp', 'expert.jsonld'])
    },
    ...list.works.filter(work => work.privacy.value === true).map(work => {
      return {
        type: 'work',
        uri: work.uri,
        // relationshipUri is needed by getSitefarmPostgresFiles to resolve the
        // corresponding ae-std/rel/{relationshipUri}.jsonld file.
        relationshipUri: work.relationshipUri,
        path: cache.getScholarlyWorkPath('work', `${config.cache.aeWebappDir}/${work.uri}.json`)
      }
    }),
    ...list.grants.filter(grant => grant.privacy.value === true).map(grant => {
      return {
        type: 'grant',
        uri: grant.uri,
        relationshipUri: grant.relationshipUri,
        path: cache.getScholarlyWorkPath('grant', `${config.cache.aeWebappDir}/${grant.uri}.json`)
      }
    })
  ]

  return results;
}

function getMivPostgresFiles(user, files=[]) {
  return files
    .filter(file => file.type === 'expert' || file.type === 'grant')
    .map(file => {
      if (file.type !== 'grant') {
        return file;
      }

      // get grant relationship file
      if (file.relationshipUri) {
        return {
          ...file,
          path: cache.getUserPath(user, ['ae-std', 'rel', file.relationshipUri+'.jsonld'])
        };
      }

      return file;
    });
}

/**
 * Build the file list consumed by loadSitefarmPostgres:
 *   - one personAeStd entry pointing at ae-std/person.jsonld
 *   - zero or more work entries pointing at ae-std/rel/{relationshipUri}.jsonld
 *
 * The expert profile is sourced from ae-std (not the ae-webapp expert.jsonld)
 * so the sitefarm postgres API path is decoupled from the elasticsearch
 * projection.
 */
function getSitefarmPostgresFiles(user, files=[]) {
  const result = [{
    type: 'personAeStd',
    path: cache.getUserPath(user, ['ae-std', 'person.jsonld'])
  }];

  for (const file of files) {
    if (file.type !== 'work') continue;
    if (!file.relationshipUri) continue;

    result.push({
      type: 'work',
      uri: file.uri,
      relationshipUri: file.relationshipUri,
      path: cache.getUserPath(user, ['ae-std', 'rel', file.relationshipUri+'.jsonld'])
    });
  }

  return result;
}

export default run;