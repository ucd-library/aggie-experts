import { Command } from 'commander';
import { ensureCurrentIndexes, createIndex, deleteIndex, setAlias, getState, deleteSearchScript, loadSearchScript, getUsersCurrentScholarlyWorks } from '../lib/load/elastic-search/index.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';
import path from 'path';
import { readFile } from 'fs/promises';
import { Temporal } from '@js-temporal/polyfill';
import { getTodaysDate } from '../lib/year-week.js';


const __dirname = path.dirname(new URL(import.meta.url).pathname);


const program = new Command();


program
  .command('ensure')
  .description('Ensure current ElasticSearch indexes and aliases for aggie experts')
  .action(async (opts={}) => {
    logger.info('Ensuring current ElasticSearch indexes for aggie experts...');
    let indexes = await ensureCurrentIndexes();
    logger.info('ElasticSearch indexes ensured successfully.', indexes);
  });

program
  .command('create-index')
  .description('Create specific ElasticSearch indexes for aggie experts')
  .option('-w, --year-week <year-week>', 'YYYY-MM format. Week number for the index (1-52)')
  .option('-d, --date <date>', 'Date for the index (format: iso)')
  .action(async (opts={}) => {
    let date;
    if( opts.date ) {
      date = Temporal.PlainDate.from(opts.date);
    } else if( opts.yearWeek ) {
      date = opts.yearWeek;
    } else {
      logger.error('You must provide either a date or a week and year for the index');
      process.exit(1);
    }

    for( let baseName in config.elasticsearch.indexes ) {
      baseName = config.elasticsearch.indexes[baseName];
      try {
        await createIndex(baseName, date);
      } catch (error) {
        logger.error(`Error creating index for ${baseName} with date:`, date, error);
      }
    }
  });

program
  .command('delete-index')
  .description('Delete specific ElasticSearch indexes for aggie experts')
  .option('-w, --year-week <year-week>', 'YYYY-MM format. Week number for the index (1-52)')
  .option('-d, --date <date>', 'Date for the index (format: iso)')
  .action(async (opts={}) => {
    let date;
    if( opts.date ) {
      date = Temporal.PlainDate.from(opts.date);
    } else if( opts.yearWeek ) {
      date = opts.yearWeek;
    } else {
      logger.error('You must provide either a date or a week and year for the index');
      process.exit(1);
    }

    for( let baseName in config.elasticsearch.indexes ) {
      baseName = config.elasticsearch.indexes[baseName];
      await deleteIndex(baseName, date);
    }
  });

program
  .command('set-alias')
  .argument('<alias>', 'Alias name to set; either current or stage')
  .option('-w, --year-week <year-week>', 'YYYY-MM format. Week number for the index (1-52)')
  .option('-d, --date <date>', 'Date for the index (format: iso)')
  .option('-c, --current', 'Set the current week')
  .action(async (alias, opts={}) => {
    let date;
    if( opts.date ) {
      date = Temporal.PlainDate.from(opts.date);
    } else if( opts.yearWeek ) {
      date = opts.yearWeek;
    } else if( opts.current ) {
      date = getTodaysDate();
    } else {
      logger.error('You must provide either a date or a week and year for the index');
      process.exit(1);
    }

    for( let baseName in config.elasticsearch.indexes ) {
      baseName = config.elasticsearch.indexes[baseName];
      await setAlias(baseName, date, alias);
    }
  });

program
  .command('state')
  .description('Show the current state of indexes and aliases for aggie experts')
  .option('--verbose', 'Show detailed state information')
  .action(async (opts={}) => {
    let state = await getState();
    
    if( !opts.verbose ) {
      state.indexes = state.indexes.map( idx => ({ index: idx.index, docs : idx['docs.count'] }) );
      state.aliases = state.aliases.map( al => ({ alias: al.alias, index: al.index }) );
    }

    console.log(state);

  });

program
  .command('load-search-template')
  .description('Load search template script into Elasticsearch')
  .option('-t, --template <name>', 'Template name to load (default: complete)', 'complete')
  .action(async (opts={}) => {
    let templateName = opts.template;
    
    try {
      let templatePath = path.join(__dirname, '../../webapp/models/search/template', `${templateName}.js`);
      let fileContent = await readFile(templatePath, 'utf8');
      
      // parse commonJS file
      let templateMatch = fileContent.match(/template\s*=\s*({[\s\S]*?});[\s\S]*module\.exports/);
      if (!templateMatch) {
        throw new Error(`Could not parse template from ${templateName}.js`);
      }
      
      let template = eval(`(${templateMatch[1]})`);
      if (!template || !template.id || !template.script) {
        throw new Error(`Invalid template structure: missing id or script property`);
      }
      
      await deleteSearchScript(template.id);
      await loadSearchScript(template.id, template.script);
      
      logger.info(`Successfully loaded search template: ${template.id}`);
    } catch (error) {
      logger.error(`Error loading search template ${templateName}:`, error.message);
      process.exit(1);
    }
  });

program
  .command('get-users-scholarly-works')
  .description('Get scholarly works for a specific user')
  .argument('type', 'Type of scholarly works to fetch (work or grant)')
  .argument('<user-id>', 'User ID to fetch scholarly works for')
  .option('--alias <alias>', 'ElasticSearch alias to query (default: stage)', 'stage')
  .action(async (type, userId, opts={}) => {
    try {
      let workIds = await getUsersCurrentScholarlyWorks(userId, type, opts.alias);
      console.log(workIds.join('\n'));
    } catch (error) {
      logger.error(`Error fetching scholarly works for user ${userId}:`, error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
