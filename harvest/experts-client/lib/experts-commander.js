import { Command as OriginalCommand, Option } from 'commander';
import { ElementsClient } from '@ucd-lib/experts-api';

export class Command extends OriginalCommand {
  constructor(...args) {
    super(...args);
  }

  option_cdl() {
    this.addOption(new Option('--cdl <env>', 'cdl environment').choices(['qa', 'prod']).default('prod'));
    return this;
  }

  opts() {
    const opts=super.opts();
    if (opts.cdl) {
      opts.cdl=ElementsClient.info(opts.cdl);
    }
    return opts;
  }
}
