import fs from 'fs';
import path from 'path';
import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
import { loadFiles as loadEs } from './elastic-search/index.js';

async function run(user, alias='stage') {
  // check which aliases to write to.  ALL means both stage & current
  if( alias === 'all' ) {
    alias = [config.elasticsearch.aliases.stage, config.elasticsearch.aliases.current];
  } else {
    alias = [alias]
  }

  // get the root directory for this user's ae-webapp files
  const webappDir = cache.getUserPath(user, config.cache.aeWebappDir);
  
  // find all jsonld files in the webapp directory
  const files = await findJsonldFiles(webappDir);

  // load files into elastic search
  let indexes = await loadEs(files, alias);

  // Insert load statistics on scholarly output into database if reporting is enabled
  if (config.reporting.enabled && config.postgres.client) {
    await reportScholarlyOutputLoadStats(user, files);
  }
  
  logger.info(`Loaded data into elastic search for user: ${user}`);

  return indexes;
}

async function reportScholarlyOutputLoadStats(user, files) {
    // Count works and grants for reporting
  let workStats = await countUserAssets(user, files, 'work');
  let grantStats = await countUserAssets(user, files, 'grant');

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

async function countUserAssets(user, files, assetType) {
  let publicCount = 0;
  let privateCount = 0;
  
  // Process all webapp files (they may contain embedded assets)
  const webappFiles = files.filter(file => {
    const filename = path.basename(file);
    return filename.startsWith('webapp.') && filename.endsWith('.jsonld');
  });
  
  for (const file of webappFiles) {
    try {
      const content = JSON.parse(await cache.read(file));
      
      // Handle different file structures
      let graphItems = [];
      if (content['@graph']) {
        // Expert files with embedded @graph array
        graphItems = content['@graph'];
      } else if (Array.isArray(content)) {
        // Files that are arrays themselves
        graphItems = content;
      } else {
        // Single object files
        graphItems = [content];
      }
      
      // Define valid types for each asset category
      const ASSET_TYPE_MAP = {
        work: [
          'Work',
          'Publication',
          'Article',
          'Book',
          'Chapter'
        ],
        grant: [
          'Grant',
          'Grant_Research',
          'Grant_Teaching'
        ]
      };
      
      // Filter for the asset type we're counting
      const targetAssets = graphItems.filter(item => {
        if (!item['@type']) return false;
        
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        const validTypes = ASSET_TYPE_MAP[assetType] || [];
        
        return types.some(type => validTypes.includes(type));
      });
      
      // Count visibility for each asset
      for (const asset of targetAssets) {
        let isVisible = true; // Default to visible
        
        // Check visibility in relatedBy relationships
        if (asset.relatedBy && Array.isArray(asset.relatedBy)) {
          // Look for visibility in the relationship data
          const visibilityInfo = asset.relatedBy.find(rel => 
            rel.hasOwnProperty('is-visible') && rel['inheres_in']
          );
          if (visibilityInfo) {
            isVisible = visibilityInfo['is-visible'] === true;
          }
        } else if (asset.hasOwnProperty('is-visible')) {
          // Direct visibility property
          isVisible = asset['is-visible'] === true;
        }
        
        if (isVisible) {
          publicCount++;
        } else {
          privateCount++;
        }
      }
      
    } catch (error) {
      logger.warn(`Error reading file for counting: ${file}`, error);
    }
  }
  
  return [
    {
      type: assetType === 'work' ? 'works' : 'grants',
      visibility: 'public',
      count: publicCount
    },
    {
      type: assetType === 'work' ? 'works' : 'grants',
      visibility: 'private',
      count: privateCount
    }
  ];
}

async function findJsonldFiles(dir) {
  let results = [];
  const list = await cache.readdir(dir, true);

  for( let file of list.files ) {
    if( file.filename.endsWith('.jsonld') ) {
      results.push(file.filepath);
    }
  }

  for (const dir of list.directories) {
    const dirFiles = await findJsonldFiles(dir.filepath);
    results = results.concat(dirFiles);
  }

  return results;
}

export default run;