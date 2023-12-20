import { Command as OriginalCommand, Option } from 'commander';

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
    const cdl={
      qa:{
        url : 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
        authname : 'qa-oapolicy',
        secretpath : 'projects/326679616213/secrets/cdl_elements_json'
      },
      prod: {
        url : 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
        authname : 'oapolicy',
        secretpath : 'projects/326679616213/secrets/cdl_elements_json'
      }
    };

    if (opts.cdl) {
      opts.cdl=cdl[opts.cdl]
    }
    return opts;
  }
}
