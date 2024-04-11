
import pkg from 'csvtojson';
const { csv } = pkg;

import fs from 'fs';
import { Command } from 'commander';

const program = new Command();

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

program
  .version('1.0.0')
  .description('Upload a file to a remote SFTP server')
  .requiredOption('-n, --new <new>', 'New grant file set path')
  .requiredOption('-p, --prev <prev>', 'Previous grant file set path')
  .requiredOption('-o, --output <output>', 'Local output file path')
  .requiredOption('-pf, --prefix <prefix>', 'Prefix for the output file', '')
  .parse(process.argv);

let opt = program.opts();

const newGrantsPath = opt.new + '/' + opt.prefix + 'grants.csv';
const oldGrantsPath = opt.prev + '/' + opt.prefix + 'grants.csv';
const newLinksPath = opt.new + '/' + opt.prefix + 'links.csv';
const oldLinksPath = opt.prev + '/' + opt.prefix + 'links.csv';
const newPersonsPath = opt.new + '/' + opt.prefix + 'persons.csv';
const oldPersonsPath = opt.prev + '/' + opt.prefix + 'persons.csv';

// Ensure the output directory exists
if (!fs.existsSync(opt.output)) {
  fs.mkdirSync(opt.output, { recursive: true });
}

csv()
  .fromFile(newGrantsPath)
  .then((newGrants) => {
    console.log('New grants read');
    csv()
      .fromFile(oldGrantsPath)
      .then((oldGrants) => {
        console.log('Old grants read done');
        // For each new object, check if it exists in the old object based on the "id" field.
        // If it doesn't exist, add it to the delta object.
        const deltaGrants = newGrants.filter((newItem) => {
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
        console.log('Delta-grants:', deltaGrants.length);
        // Write the delta object to a new CSV file.
        const deltaFilePath = opt.output + '/' + opt.prefix + 'grants.csv'; // replace with your desired delta CSV file path
        fs.writeFileSync(deltaFilePath, 'id,category,type,title,c-pi,funder-name,funder-reference,start-date,end-date,amount-value,amount-currency-code,funding-type,c-ucop-sponsor,c-flow-thru-funding,visible\n' + deltaGrants.map((item) => Object.values(item).join(',')).join('\n'));

      });
  });

csv()
  .fromFile(newLinksPath)
  .then((newLinks) => {
    console.log('New links read');
    csv()
      .fromFile(oldLinksPath)
      .then((oldLinks) => {
        console.log('Old links read done');
        // For each new object, check if it exists in the old object based on the "id" field.
        // If it doesn't exist, add it to the delta object.
        const deltaLinks = newLinks.filter((newItem) => {
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
        const deltaFilePath = opt.output + '/' + opt.prefix + 'links.csv'; // replace with your desired delta CSV file path
        fs.writeFileSync(deltaFilePath, 'category-1,id-1,category-2,id-2,link-type-id,visible\n' + deltaLinks.map((item) => Object.values(item).join(',')).join('\n'));

      });
  });

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
        const deltaPersons = newPersons.filter((newItem) => {
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
        const deltaFilePath = opt.output + '/' + opt.prefix + 'persons.csv'; // replace with your desired delta CSV file path
        fs.writeFileSync(deltaFilePath, 'category,id,field-name,surname,first-name,full-name\n' + deltaPersons.map((item) => Object.values(item).join(',')).join('\n'));

      });
  });

