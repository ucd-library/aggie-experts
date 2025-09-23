import fs from 'fs';
import path from 'path';
import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
import { loadFiles as loadEs } from './elastic-search/index.js';

async function run(user, alias='stage') {
  if( alias === 'all' ) {
    alias = [config.elasticsearch.aliases.stage, config.elasticsearch.aliases.current];
  } else {
    alias = [alias]
  }

  const webappDir = cache.getPath(user, config.cache.aeWebappDir);
  const files = findJsonldFiles(webappDir);

  let indexes = await loadEs(files, alias);

  // Count works and grants for reporting
  let workStats = await countUserAssets(user, files, 'work');
  let grantStats = await countUserAssets(user, files, 'grant');
  
  // Insert load statistics into database if reporting is enabled
  if (config.reporting.enabled && config.postgres.client) {
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
  
  logger.info(`Loaded data into elastic search for user: ${user}`);

  return indexes;
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
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      
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
      
      // Filter for the asset type we're counting
      const targetAssets = graphItems.filter(item => {
        if (!item['@type']) return false;
        
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        
        if (assetType === 'work') {
          return types.some(type => 
            type.includes('Work') || 
            type.includes('Publication') || 
            type.includes('Article') ||
            type.includes('Book') ||
            type.includes('Chapter')
          );
        } else if (assetType === 'grant') {
          return types.some(type => 
            type.includes('Grant') || 
            type === 'Grant_Research' ||
            type === 'Grant_Teaching'
          );
        }
        return false;
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

function findJsonldFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findJsonldFiles(filePath));
    } else if (file.endsWith('.jsonld')) {
      results.push(filePath);
    }
  }

  return results;
}

export default run;