import { Command as OriginalCommand, Option } from 'commander';
import { CdlClient } from './cdl-client.js';
import { logger } from './logger.js';
import { IAM } from './iam-client.js';

export class Command extends OriginalCommand {
  constructor(...args) {
    super(...args);
  }

  option_cdl() {
    this.addOption(new Option('--cdl <env>', 'cdl environment').choices(['qa', 'prod']).default('prod'));
    this.addOption(new Option('--cdl.timeout <timeout>', 'Specify CDL API timeout in milliseconds').default(30000))
    return this;
  }

  option_iam() {
    this.addOption(new Option('--iam <dev|prod>', 'iam environment').choices(['dev', 'prod']).default('prod'));
    this.addOption(new Option('--iam.timeout <timeout>', 'Specify IAM API timeout in milliseconds').default(30000))
    return this;
  }

  option_fuseki() {
    this.addOption(new Option('--fuseki <http://admin:testing123@localhost:3030>', 'fuseki authentication and location').default('http://admin:testing123@localhost:3030'));
    return this;
  }

  option_log() {
    this.addOption(new Option('--log <>', 'log level').choices(['debug','info', 'warn','error','fatal']).default('fatal'));
    return this;
  }

  opts() {
    const opts=super.opts();
    if (opts.log) {
      opts.log=logger.child({level:opts.log});
    }
    if (opts.cdl) {
      opts.cdl=new CdlClient(
        { env:opts.cdl,
          timeout:opts["cdl.timeout"],
          log:opts.log
        });
    }
    if (opts.fuseki) {
      opts.fuseki={url:opts.fuseki,type:'tdb2'};
    }
    if (opts.iam) {
      opts.iam=new IAM(
        {env:opts.iam,
         timeout:opts['iam.timeout'],
         log:opts.log}
      );
    }
    return opts;
  }
}
