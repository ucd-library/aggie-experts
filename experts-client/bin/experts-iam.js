import { Command} from 'commander';
import ExpertsClient from '../lib/experts-client.js';

const program = new Command();

program.command('getIam')
  .description('Import IAM Researcher Profiles')
  .option('--iam-auth, -a <>', 'API Key for IAM')
  .option('--endpoint, -e <>', 'Endpoint for IAM', 'https://iet-ws-stage.ucdavis.edu/api/iam/people/profile/search?isFaculty=true')
  .action(async(options) => {
    const key = process.env.EXPERTS_IAM_AUTH;
    const endPoint = process.env.EXPERTS_IAM_ENDPOINT;
    
    const ec = new ExpertsClient(endPoint, key);
    
    async function main() {
        console.log('starting getIAMProfiles');
        ec.doc = await ec.getIAMProfiles();
        console.log('done with getIAMProfiles');
    
        await ec.processDoc().then(() => {
            console.log('done with processDoc');
        })
    }
    main();
});
program.parse(process.argv);
