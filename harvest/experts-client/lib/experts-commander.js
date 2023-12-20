import { Command as OriginalCommand, Option } from 'commander';

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

    if (opts.iam) {
      opts.iam={ env: opts.iam
                 timeout: opts.iam.timeout
               };
    }

    if (opts.cdl.timeout) {
      cdl[opts.cdl].timeout=opts.cdl.timeout;
    }
    opts.cdl=cdl[opts.cdl]
    return opts;
  }
}
