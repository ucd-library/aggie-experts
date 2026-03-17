import { Command } from 'commander';
import { ai, config } from '@ucd-lib/experts-commons';

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

program.parse(process.argv);