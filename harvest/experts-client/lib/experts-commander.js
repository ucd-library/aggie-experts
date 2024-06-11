import { Command as OriginalCommand, Option } from 'commander';
import { CdlClient } from './cdl-client.js';
import { logger } from './logger.js';
import { IAM } from './iam-client.js';
import { GoogleSecret, ExpertsKcAdminClient } from '@ucd-lib/experts-api';

export class Command extends OriginalCommand {
  constructor(...args) {
    super(...args);
    this.gs= new GoogleSecret();
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

  option_kcadmin() {
    this.addOption(new Option('--kcadmin', 'keycloak admin').default(true));
    this.addOption(new Option('--no-kcadmin', 'keycloak admin'));
    this.addOption(new Option('--kcadmin.secret <secret>','Keycloak client secret').default('projects/325574696734/secrets/service-account-harvester'))
    return this;
  }

  option_log() {
    this.addOption(new Option('--log <>', 'log level').choices(['debug','info', 'warn','error','fatal']).default('fatal'));
    return this;
  }

  async opts() {
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
    if (opts.kcadmin) {
      console.log(`gs.getSecret(${opts['kcadmin.secret']});`);
      const resp=await this.gs.getSecret(opts['kcadmin.secret']);
      const secret = JSON.parse(resp);

      opts.kcadmin = new ExpertsKcAdminClient(
        {
          baseUrl: secret.baseUrl,
          realmName: secret.realmName
        },
      )
      try {
        await opts.kcadmin.auth(secret.auth);
      } catch (e) {
        logger.error('Error getting keycloak authorized', e);
        process.exit(1);
      }
    }
    return opts;
  }
}
