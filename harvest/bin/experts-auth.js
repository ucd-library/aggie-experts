import { Command } from 'commander';
import { ExpertsKcAdminClient } from '@ucd-lib/experts-commons';

const program = new Command();

program
  .command('token')
  .description('Get an access token for the specified service')
  .option('-s, --service-name <service-name>', 'Service name to get the token for (e.g. "webapp", "harvest")')
  .action(async (opts={}) => {
    const kcAdminClient = new ExpertsKcAdminClient();
    try {
      const {body} = await kcAdminClient.generateServiceAccountToken({serviceName: opts.serviceName});
      console.log(body.access_token);
    } catch (error) {
      console.error('Error getting token:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);