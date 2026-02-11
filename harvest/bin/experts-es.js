import { Command } from 'commander';
import { 
  ensureCurrentIndexes, 
  createIndex, 
  deleteIndex, 
  setAlias, 
  getState, 
  loadSearchTemplate, 
  initPipeline 
} from '../lib/load/elastic-search/index.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';


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
      date = new Date(opts.date);
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
      date = new Date(opts.date);
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
      date = new Date(opts.date);
    } else if( opts.yearWeek ) {
      date = opts.yearWeek;
    } else if( opts.current ) {
      date = new Date();
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
      await loadSearchTemplate(templateName);
    } catch (error) {
      logger.error(`Error loading search template ${templateName}:`, error.message);
      process.exit(1);
    }
  });

  program
  .command('init-pipeline')
  .description('Initialize the Dagster pipeline for aggie experts')
  .action(async (opts={}) => {
    try {
      await initPipeline();
      logger.info('Dagster pipeline initialized successfully.');
    }
    catch (error) {
      logger.error('Error initializing Dagster pipeline:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
