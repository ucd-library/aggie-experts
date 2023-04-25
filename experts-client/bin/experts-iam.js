import { Command} from 'commander';
import ExpertsClient from '../lib/experts-client.js';

const program = new Command();

program.command('getIam')
  .description('Import IAM Researcher Profiles')
  .option('--iam-auth, -a <>', 'API Key for IAM')
  .option('--endpoint, -e <>', 'Endpoint for IAM', 'https://iet-ws-stage.ucdavis.edu/api/iam/people/profile/search?isFaculty=true')
  .action(async(options) => {
    // const key = process.env.EXPERTS_IAM_AUTH;
    const endPoint = process.env.EXPERTS_IAM_ENDPOINT;
    const ec = new ExpertsClient(endPoint);
    async function getIAMSecret() {
        try {
            ec.IamKey = await ec.getSecret();
        }
        catch (e) { 
            console.log('getIAMSecret error: ' + e);
        }
    }

    async function getIAMProfiles() {
        console.log('starting getIAMProfiles');
        try {
            ec.doc = await ec.getIAMProfiles();
        }   
        catch (e) {
            console.log('getIAMProfiles error: ' + e);
        }
    }

    async function processIAMProfiles() {
        console.log('starting processIAMProfiles');
        try {
            await ec.processIAMProfiles();
        }
        catch (e) {
            console.log('processIAMProfiles error: ' + e);
        }
    }

    // console.log('iamKey: ' + ec.IamKey);
    await getIAMSecret();
    console.log('done with getIAMSecret');
    await getIAMProfiles();
    console.log('done with getIAMProfiles');
    await processIAMProfiles();
    console.log('done with processIAMProfiles');
    

});
program.parse(process.argv);
