import ExpertsClient from './experts-client.js';

const key = 'your api key here';
const ec = new ExpertsClient('https://iet-ws-stage.ucdavis.edu/api/iam/people/profile/search?isFaculty=true', key);


async function main() {
    ec.doc = await ec.getIAMProfiles();
    console.log(ec.doc);
    console.log('done with getIAMProfiles');
    
    await ec.processDoc().then(() => {
        console.log('done with processDoc');
    })
}

await main();
console.log('test done');

