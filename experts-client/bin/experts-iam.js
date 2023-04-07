import { Command} from 'commander';
import ExpertsClient from '../lib/experts-client.js';

const program = new Command();

program.command()
  .description('Import IAM Researcher Profiles')
  .option('--iam-auth, -a <iam-auth>', 'API Key for IAM')
  .option('--endpoint, -u <endpoint>', 'Endpoint for IAM', 'https://iet-ws-stage.ucdavis.edu/api/iam/people/profile/search?isFaculty=true')
  .action((options) => {
    const key = process.env.EXPERTS_IAM_AUTH;
    const endPoint = process.env.EXPERTS_IAM_ENDPOINT;
    
    const ec = new ExpertsClient(endPoint, key);
    
    (async function () {
        ec.doc = await ec.getIAMProfiles();
        console.log(ec.doc);
        console.log('done with getIAMProfiles');
    
        await ec.processDoc().then(() => {
            console.log('done with processDoc');
        })
    })();
});
program.parse();
