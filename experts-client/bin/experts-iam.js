import { Command} from 'commander';
import ExpertsClient from '../lib/experts-client.js';

console.log('starting experts-iam');
const program = new Command();

program.command('getIam')
  .description('Import IAM Researcher Profiles')
  .action(async(options) => {

    console.log('starting getIam');
    program.parse(process.argv);
    console.log('getIam');
    
    const cli = program.opts();
    const ec = new ExpertsClient(cli);

    // async function getIAMSecret() {
    //     try {
    //         ec.IamKey = await ec.getSecret('projects/326679616213/secrets/ucdavis-iam-api-key');
    //         ec.fusekiKey = await ec.getSecret('projects/326679616213/secrets/ucdavis-iam-fuseki-key');
    //     }
    //     catch (e) { 
    //         console.log('getIAMSecret error: ' + e);
    //     }
    // }

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

    // await getIAMSecret().then(() => {
    //     console.log('done with getIAMSecret');
    // });
    
    getIAMProfiles().then(() => {
        console.log('done with getIAMProfiles');
    });
    
    processIAMProfiles().then(() => {
        console.log('done with processIAMProfiles');
    
    ec.createDataset()
        .then(() => console.log('dataset created'))
        
    ec.createGraph()
        .then(() => console.log('graph created'));        
    });
});


