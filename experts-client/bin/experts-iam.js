'use strict';
import { Command} from 'commander';
import ExpertsClient from '../lib/experts-client.js';

console.log('starting experts-iam');
const program = new Command();
    
async function main() {

    const ec = new ExpertsClient();

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
    
    async function createDataset() {
        console.log('starting createDataset');
        try {
            await ec.createDataset('iam-profiles','tdb');
        }
        catch (e) {
            console.log('createDataset error: ' + e);
        }
    }
    
    async function createGraph() {
        console.log('starting createGraph');
        try {
            await ec.createGraph('iam-profiles');
        }
        catch (e) {
            console.log('createGraph error: ' + e);
        }
    }
    
    async function splay() {
        console.log('starting splay');
        try {
            await ec.splay();
        }
        catch (e) {
            console.log('splay error: ' + e);
        }
    }
    
    await getIAMProfiles().then(() => console.log('done with getIAMProfiles'));
    await processIAMProfiles().then(() => console.log('done with processIAMProfiles'));
    await createDataset().then(() => console.log('done with createDataset'));
    await createGraph().then(() => console.log('done with createGraph'));
    await splay().then(() => console.log('done with splay'));
    
}

program.name('iam')
.description('Import IAM Researcher Profiles')
.option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
.option('--quadstore <quadstore>', 'Specify a local quadstore.  Cannot be used with the --source option')
// .action(main);

program.parse(process.argv);
main();