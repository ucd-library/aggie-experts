import { Command as OriginalCommand, Option } from 'commander';
import { logger } from './logger.js';
import { IAM } from './iam-client.js';

export class Command extends OriginalCommand {
  constructor(...args) {
    super(...args);
  }

  option_cdl() {
    this.addOption(new Option('--cdl <qa|proc>', 'cdl environment').choices(['qa', 'prod']).default('prod'));
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
    this.addOption(new Option('--log <>', 'log level').choices(['info', 'warn','error','fatal']).default('info'));
    return this;
  }

  opts() {
    const opts=super.opts();
    const cdl={
      qa:{
        url : 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
        authname : 'qa-oapolicy',
        secretpath : 'projects/326679616213/secrets/cdl_elements_json',
        timeout : 30000
      },
      prod: {
        url : 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
        authname : 'oapolicy',
        secretpath : 'projects/326679616213/secrets/cdl_elements_json',
        timeout : 30000
      }
    };

    if (opts.log) {
      logger.level(opts.log);
      opts.log=logger;
    }

    if (opts.iam) {
      opts.iam={ env: opts.iam,
                 timeout: opts['iam.timeout']
               };
      opts.iam = new IAM(opts.iam);
    }

    if (opts['cdl.timeout']) {
      cdl[opts.cdl].timeout=opts.cdl.timeout;
    }
    opts.cdl=cdl[opts.cdl]

    if (opts.fuseki) {
      opts.fuseki={ url: opts.fuseki };
    }

    return opts;
  }
}
