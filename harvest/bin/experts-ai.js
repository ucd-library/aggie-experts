import { Command } from 'commander';
import { Ollama, config } from '@ucd-lib/experts-commons';
import ai from '../lib/ai/index.js';

const program = new Command();

program
  .command('summerize-new-experts')
  .description('Summarize newly indexed experts')
  .option('-m, --model <model>', `LLM model to use, defaults to ${config.llm.model}`)
  .option('-H, --host <host>', `LLM host to use, defaults to ${config.llm.host}`)
  .action(async (opts={}) => {
    try {
      const summary = await ai.summerizeNewExperts(opts);
      console.log(summary.response);
    } catch (error) {
      console.error('Error summarizing new experts:', error);
      process.exit(1);
    }
  });

program
  .command('embed')
  .description('Generate and cache an embedding for a work by ARK')
  .argument('<ark>', 'publication ARK, e.g. ark:/87287/d7mh2m/publication/2364120')
  .option('-y, --year-week <yearWeek>', 'year-week in YYYY-WW format, defaults to latest in cask')
  .option('-m, --model <model>', `embedding model to use, defaults to ${config.llm.embedModel}`)
  .option('-H, --host <host>', `ollama host to use, defaults to ${config.llm.host}`)
  .option('-n, --normalize', 'L2-normalize the embedding vector after retrieval')
  .option('-l, --max-length <maxLength>', 'clip embedding to this many dimensions', parseInt)
  .action(async (ark, opts={}) => {

    try {
      const result = await ai.embedWork(ark, opts);
      console.log({
        ark: result.ark,
        yearWeek: result.yearWeek,
        hash: result.hash,
        embedCachePath: result.embedCachePath,
        embeddingLength: result.embedding.length,
        text: result.text
      });
    } catch (error) {
      console.error('Error generating embedding:', error);
      process.exit(1);
    }
  });

program
  .command('embed-grant')
  .description('Generate and cache an embedding for a grant by ARK')
  .argument('<ark>', 'grant ARK')
  .option('-y, --year-week <yearWeek>', 'year-week in YYYY-WW format, defaults to latest in cask')
  .option('-m, --model <model>', `embedding model to use, defaults to ${config.llm.embedModel}`)
  .option('-H, --host <host>', `ollama host to use, defaults to ${config.llm.host}`)
  .option('-n, --normalize', 'L2-normalize the embedding vector after retrieval')
  .option('-l, --max-length <maxLength>', 'clip embedding to this many dimensions', parseInt)
  .action(async (ark, opts={}) => {
    try {
      const result = await ai.embedGrant(ark, opts);
      console.log({
        ark: result.ark,
        yearWeek: result.yearWeek,
        hash: result.hash,
        embedCachePath: result.embedCachePath,
        embeddingLength: result.embedding.length,
        text: result.text
      });
    } catch (error) {
      console.error('Error generating grant embedding:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
