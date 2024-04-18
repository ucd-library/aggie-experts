
import pkg from 'csvtojson';
const { csv } = pkg;

import fs from 'fs';
import { Command } from 'commander';

const program = new Command();

// Setup getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

program
  .version('1.0.0')
  .description('Upload a file to a remote SFTP server')
  .option('--env <env>', '', 'QA')
  .requiredOption('-n, --new <new>', 'New grant file set path')
  .requiredOption('-p, --prev <prev>', 'Previous grant file set path')
  .requiredOption('-d, --delta <delta>', 'Delta grant file set path')
  // .requiredOption('-o, --output <output>', 'Local output file path')
  .parse(process.argv);

let opt = program.opts();

if (opt.env === 'PROD') {
  opt.prefix = 'Prod_UCD_';
} else if (opt.env === 'QA') {
  opt.prefix = '';
} else {
  opt.prefix = '';
}

const newGrantsPath = opt.new + '/' + opt.prefix + 'grants_metadata.csv';
const oldGrantsPath = opt.prev + '/' + opt.prefix + 'grants_metadata.csv';
const newLinksPath = opt.new + '/' + opt.prefix + 'grants_links.csv';
const oldLinksPath = opt.prev + '/' + opt.prefix + 'grants_links.csv';
const newPersonsPath = opt.new + '/' + opt.prefix + 'grants_persons.csv';
const oldPersonsPath = opt.prev + '/' + opt.prefix + 'grants_persons.csv';

console.log('New grants path:', newGrantsPath);
console.log('Old grants path:', oldGrantsPath);
console.log('New links path:', newLinksPath);
console.log('Old links path:', oldLinksPath);
console.log('New persons path:', newPersonsPath);
console.log('Old persons path:', oldPersonsPath);


var deltaGrants = [];
var deltaLinks = [];
var deltaPersons = [];
var newGrants = [];
var oldGrants = [];
var newLinks = [];
var oldLinks = [];
var newPersons = [];
var oldPersons = [];

// Ensure the output directory exists
if (!fs.existsSync(opt.delta)) {
  fs.mkdirSync(opt.delta, { recursive: true });
}

async function readGrants() {

  return new Promise((resolve, reject) => {
    csv()
  .fromFile(newGrantsPath)
  .then((newGrants) => {
    console.log('New grants read');
    csv()
      .fromFile(oldGrantsPath)
      .then((oldGrants) => {
        console.log('Old grants read');
        // For each new object, check if it exists in the old object based on the "id" field.
        // If it doesn't exist, add it to the delta object.
        deltaGrants = newGrants.filter((newItem) => {
          let isNew = !oldGrants.find((oldItem) => oldItem.id === newItem.id);
          //if isNew or the grant has been updated
          if (isNew) {
            console.log('New grant:', newItem.id);
            console.log('-----------------');
            return true;
          }
          else {
            let oldItem = oldGrants.find((oldItem) => oldItem.id === newItem.id);
            let isUpdated = false;
            // For each oldItem key, check if it is different from the newItem key
            // If isUpdated is true, return true
            for (let key in oldItem) {
              if (oldItem[key] !== newItem[key]) {
                console.log('Updated Grant: ' + oldItem.id + ' Old:' + key, oldItem[key]);
                console.log('Updated Grant: ' + newItem.id + ' New:' + key, newItem[key]);
                console.log('-----------------');
                isUpdated = true;
              }
            }
            return isUpdated;
          }
        });
        resolve();
      });
  });
  }
  );
}

async function readLinks() {

  return new Promise((resolve, reject) => {

    csv().fromFile(newLinksPath)
      .then((newLinks) => {
        console.log('New links read');
        csv()
      .fromFile(oldLinksPath)
      .then((oldLinks) => {
        console.log('Old links read');
        // For each new object, check if it exists in the old object based on the "id" field.
        // If it doesn't exist, add it to the delta object.
        deltaLinks = newLinks.filter((newItem) => {
          let isNew = !oldLinks.find((oldItem) => oldItem["id-2"] === newItem["id-2"]);
          //if isNew or the grant has been updated
          if (isNew) {
            console.log('New link:', newItem["id-1"] + ' / ' + newItem["id-2"] + ' / ' + newItem["link-type-id"]);
            console.log('-----------------');
            return true;
          }
          else {
            let oldItem = oldLinks.find((oldItem) => oldItem["id-1"] === newItem["id-1"] && oldItem["id-2"] === newItem["id-2"]);
            let isUpdated = false;
            // For each oldItem key, check if it is different from the newItem key
            // If isUpdated is true, return true
            for (let key in oldItem) {
              if (oldItem[key] !== newItem[key]) {
                console.log('Updated Link:' + oldItem["id-1"] + ' / ' + oldItem["id-2"] + ' Old:' + key, oldItem[key]);
                console.log('Updated Link:' + newItem["id-1"] + ' / ' + newItem["id-2"] + ' New:' + key, newItem[key]);
                console.log('-----------------');
                isUpdated = true;
              }
            }
            return isUpdated;
          }
        });
        console.log('Delta-links:', deltaLinks.length);
        // Write the delta object to a new CSV file.
        const deltaFilePath = opt.delta + '/' + opt.prefix + 'links.csv'; // replace with your desired delta CSV file path
        fs.writeFileSync(deltaFilePath, 'category-1,id-1,category-2,id-2,link-type-id,visible\n' + deltaLinks.map((item) => Object.values(item).join(',')).join('\n'));
        resolve();
      });
      });
  }
  );
}

async function readPersons() {

  return new Promise((resolve, reject) => {
    csv()
      .fromFile(newPersonsPath)
      .then((newPersons) => {
        console.log('New persons read');
        csv()
          .fromFile(oldPersonsPath)
          .then((oldPersons) => {
            console.log('Old persons read done');
        // For each new object, check if it exists in the old object based on the "id" field.
        // If it doesn't exist, add it to the delta object.
            deltaPersons = newPersons.filter((newItem) => {
          let isNew = !oldPersons.find((oldItem) => oldItem.id === newItem.id && oldItem["full-name"] === newItem["full-name"]);
          //if isNew or the grant has been updated
          if (isNew) {
            console.log('New Person:', newItem["full-name"] + ' / ' + newItem["id"]);
            console.log('-----------------');
            return true;
          }
          else {
            let oldItem = oldPersons.find((oldItem) => oldItem["id"] === newItem["id"] && oldItem["full-name"] === newItem["full-name"]);
            let isUpdated = false;
            // For each oldItem key, check if it is different from the newItem key
            // If isUpdated is true, return true
            for (let key in oldItem) {
              if (oldItem[key] !== newItem[key]) {
                console.log('Updated Person: ' + oldItem["id"] + ' / ' + oldItem["full-name"] + ' Old:' + key, oldItem[key]);
                console.log('Updated Person: ' + newItem["id"] + ' / ' + newItem["full-name"] + ' New:' + key, newItem[key]);
                console.log('-----------------');
                isUpdated = true;
              }
            }
            return isUpdated;
          }
        });

        console.log('Delta-persons:', deltaPersons.length);
        // Write the delta object to a new CSV file.
            const deltaFilePath = opt.delta + '/' + opt.prefix + 'persons.csv'; // replace with your desired delta CSV file path
            fs.writeFileSync(deltaFilePath, 'category,id,field-name,surname,first-name,full-name\n' + deltaPersons.map((item) => Object.values(item).join(',')).join('\n'));
            resolve();
          });
      }
      );
  });
}

// Add any grant that is referenced in the linksArray but not in the grants to the deltaGrants array
// For each id-1 in the linksArray, check if it exists in the deltaGrants array
async function addGrantsLinked() {
  return new Promise((resolve, reject) => {
    for (let i = 0; i < newLinks.length; i++) {
      if (!deltaGrants.find((grant) => grant.id === newLinks[i]["id-2"])) {
        if (newGrants.find((grant) => grant.id === newLinks[i]["id-2"])) {
          let grant = newGrants.find((grant) => grant.id === newLinks[i]["id-2"]);
          deltaGrants.push(grant);
          console.log('New grant linked:', grant.id);
        }
      }
    }
    resolve();
  });
}

// Add any grant that is referenced in the personsArray but not in the grants to the deltaGrants array
// For each id-1 in the linksArray, check if it exists in the deltaGrants array
async function addGrantsOfPersons() {
  return new Promise((resolve, reject) => {
    for (let i = 0; i < newPersons.length; i++) {
      // is this grant already in the deltaGrants array?
      if (!deltaGrants.find((grant) => grant.id === newPersons[i].id)) {
        // get the grant from the newGrants array
        if (newGrants.find((grant) => grant.id === newPersons[i].id)) {
          // and add it to the deltaGrants array
          let grant = newGrants.find((grant) => grant.id === newPersons[i].id);
          deltaGrants.push(grant);
          console.log('New grant of person:', grant.id);
        }
      }
    }
    resolve();
  });
}

await readGrants(); // read the new and old grants files
await readLinks(); // read the new and old links files
await readPersons(); // read the new and old persons files
await addGrantsLinked(); // add any grant that is referenced in the linksArray but not in the grants to the deltaGrants array
await addGrantsOfPersons(); // add any grant that is referenced in the personsArray but not in the grants to the deltaGrants array

console.log('Delta-grants:', deltaGrants.length);
// Write the delta object to a new CSV file.
const deltaFilePath = opt.delta + '/' + opt.prefix + 'grants_metadata.csv'; // replace with your desired delta CSV file path
fs.writeFileSync(deltaFilePath, 'id,category,type,title,c-pi,funder-name,funder-reference,start-date,end-date,amount-value,amount-currency-code,funding-type,c-ucop-sponsor,c-flow-thru-funding,visible\n' + deltaGrants.map((item) => Object.values(item).join(',')).join('\n'));




