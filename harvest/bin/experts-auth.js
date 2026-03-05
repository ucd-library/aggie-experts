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

program
  .command('validate')
  .argument('<token>', 'Access token to validate. Use "." to read from stdin')
  .description('Validate an access token')
  .action(async (token, opts={}) => {
    const kcAdminClient = new ExpertsKcAdminClient();

    if( token === '.' ) {
      token = await new Promise((resolve, reject) => {
        let input = '';
        process.stdin.on('data', chunk => input += chunk);
        process.stdin.on('end', () => resolve(input.trim()));
        process.stdin.on('error', err => reject(err));
      });
    }

    try {
      const {body, status} = await kcAdminClient.validateToken(token);
      if( status === 200 ) {
        console.log({
          valid : true,
          status : status,
          expires : new Date(body.exp * 1000).toISOString(),
          token : body
        });
      } else {
        console.log({
          valid : false,
          status, 
          body
        });
      }
      
      
    } catch (error) {
      console.error('Error validating token:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);