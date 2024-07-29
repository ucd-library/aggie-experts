import pkg from 'csvtojson';
const { csv } = pkg;

import fs from 'fs';
import { Command } from 'commander';
import { logger } from '../lib/logger.js';
import { stringify } from 'csv-stringify';

const program = new Command();

// Setup getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import csv_p from 'csv-parser';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

program
.version('1.0.0')
.description('Upload a file to a remote SFTP server')
.option('--env <env>', '', 'QA')
.option('--debug', 'Debug mode')
.requiredOption('-o, --dir <dir>', 'Working directory')
.requiredOption('-n, --new <new>', 'New grant file set path')
.requiredOption('-p, --prev <prev>', 'Previous grant file set path')
.parse(process.argv);

let opt = program.opts();

if (opt.env === 'PROD') {
  opt.prefix = 'Prod_UCD_';
} else if (opt.env === 'QA') {
  opt.prefix = '';
} else {
  opt.prefix = '';
}

const newGrantsPath = opt.dir + '/generation-' + opt.new + '/' + opt.prefix + 'grants_metadata.csv';
const oldGrantsPath = opt.dir + '/generation-' + opt.prev + '/' + opt.prefix + 'grants_metadata.csv';
const newLinksPath = opt.dir + '/generation-' + opt.new + '/' + opt.prefix + 'grants_links.csv';
const oldLinksPath = opt.dir + '/generation-' + opt.prev + '/' + opt.prefix + 'grants_links.csv';
const newPersonsPath = opt.dir + '/generation-' + opt.new + '/' + opt.prefix + 'grants_persons.csv';
const oldPersonsPath = opt.dir + '/generation-' + opt.prev + '/' + opt.prefix + 'grants_persons.csv';

if (opt.debug) {
  logger.info('New grants path:', newGrantsPath);
  logger.info('Old grants path:', oldGrantsPath);
  logger.info('New links path:', newLinksPath);
  logger.info('Old links path:', oldLinksPath);
  logger.info('New persons path:', newPersonsPath);
  logger.info('Old persons path:', oldPersonsPath);
}


var deltaGrants = [];
var deltaLinks = [];
var deltaPersons = [];
var newGrants = [];
var oldGrants = [];
var newLinks = [];
var oldLinks = [];
var newPersons = [];
var oldPersons = [];
var deleteLinks = [];

// Ensure the output directory exists
if (!fs.existsSync(opt.dir + '/' + 'delta')) {
  fs.mkdirSync(opt.dir + '/' + 'delta', { recursive: true });
}

async function readGrants() {

  var addedGrants = [];

  return new Promise((resolve, reject) => {
    csv()
    .fromFile(newGrantsPath)
    .then((innerNewGrants) => {
      newGrants = innerNewGrants;
      // logger.info('New grants read');
      // logger.info('New grants:', newGrants.length);
      csv()
      .fromFile(oldGrantsPath)
      .then((innerOldGrants) => {
        oldGrants = innerOldGrants;
        if (opt.debug) logger.info('Old grants read');
        // For each new object, check if it exists in the old object based on the "id" field.
        // If it doesn't exist, add it to the delta object.
        deltaGrants = newGrants.filter((newItem) => {
          let isNew = !oldGrants.find((oldItem) => oldItem["id"] === newItem["id"]);
          //if isNew or the grant has been updated
          if (isNew) {
            logger.info('New grant:', newItem["id"]);
            addedGrants.push(newItem);
            return true;
          }
          else {
            let oldItem = oldGrants.find((oldItem) => oldItem["id"] === newItem["id"]);
            let isUpdated = false;
            // For each oldItem key, check if it is different from the newItem key
            // If isUpdated is true, return true
            for (let key in oldItem) {
              if (oldItem[key] !== newItem[key]) {
                // logger.info('Updated Grant: ' + oldItem["id"] + ' Old:' + key, oldItem[key]);
                // logger.info('Updated Grant: ' + newItem["id"] + ' New:' + key, newItem[key]);
                isUpdated = true;
              }
            }
            return isUpdated;
          }
        });
        logger.info('New grants:', addedGrants.length);
        resolve();
      });
    });
  }
);
}

// Function to find oldLinks that are not in newLinks
// For each oldLink, check if it exists in the newLinks based on the "id-1" and "id-2" fields.
// If it doesn't exist, add it to the deleteLinks array.
async function findDeletedLinks() {
  logger.info(' -- findDeletedLinks');
  return new Promise((resolve, reject) => {
    let deleteLinks = oldLinks.filter((oldItem) => {
      let isDeleted = !newLinks.find((newItem) => newItem["id-1"] === oldItem["id-1"] && newItem["id-2"] === oldItem["id-2"]);
      if (isDeleted) {
        logger.info('Deleted link:', oldItem["id-1"] + ' / ' + oldItem["id-2"]);
        return true;
      }
      return false;
    }
  );
  // Reformat the deleteLinks array to remove the "visible", "category-1", and "category-2" fields
  deleteLinks = deleteLinks.map((item) => {
    let newItem = {};
    for (let key in item) {
      // if (key !== 'visible' && key !== 'category-1' && key !== 'category-2') {
      if (key == 'id-1') {
        newItem['user_proprietary_id'] = item[key];
      }
      else if (key == 'id-2') {
        newItem['record_proprietary_id'] = item[key];
      }
      else if (key == 'link_type_id') {
        newItem[key] = item[key];
      }
    }
    return newItem;
  }
);
  resolve(deleteLinks);
});
}

async function readLinks() {

  return new Promise((resolve, reject) => {
    // First read the old links file
    fs.createReadStream(oldLinksPath)
    .pipe(csv_p())
    .on('data', (data) => oldLinks.push(data))
    .on('end', () => {
      logger.info('oldLink read');
      // Next read the new links file
      fs.createReadStream(newLinksPath)
      .pipe(csv_p())
      .on('data', (data) => newLinks.push(data))
      .on('end', () => {
        logger.info('newLinks read');
        resolve();
      });
    });
  });
}

async function getDeltaLinks() {
  return new Promise((resolve, reject) => {

    deltaLinks = newLinks.filter((newItem) => {
      let isNew = !oldLinks.find((oldItem) => oldItem["id-2"] === newItem["id-2"]);
      //if isNew or the grant has been updated
      if (isNew) {
        logger.info('New link:', newItem["id-1"] + ' / ' + newItem["id-2"] + ' / ' + newItem["link-type-id"]);
        return true;
      }
      let oldItem = oldLinks.find((oldItem) => oldItem["id-1"] === newItem["id-1"] && oldItem["id-2"] === newItem["id-2"]);
      let isUpdated = false;
      // For each oldItem key, check if it is different from the newItem key
      // If isUpdated is true, return true
      for (let key in oldItem) {
        if (oldItem[key] !== newItem[key]) {
          logger.info('Updated Link:' + oldItem["id-1"] + ' / ' + oldItem["id-2"] + ' Old:' + key, oldItem[key]);
          logger.info('Updated Link:' + newItem["id-1"] + ' / ' + newItem["id-2"] + ' New:' + key, newItem[key]);
          isUpdated = true;
        }
      }
      if (isUpdated) {
        return true;
      }
      // The id-2 is the grant id of a grant in the deltaGrants array
      if (deltaGrants.find((grant) => grant["id"] === newItem["id-2"])) {
        return true;
      }
      return false;
    });
    if (opt.debug) logger.info('readLinks Delta links:', deltaLinks.length);
    if (opt.debug) logger.info('readLinks Old links:', oldLinks.length);
    if (opt.debug) logger.info('readLinks New links:', newLinks.length);
    resolve();
  });
}

async function readPersons() {

  return new Promise((resolve, reject) => {
    csv()
    .fromFile(newPersonsPath)
    .then((innerNewPersons) => {
      newPersons = innerNewPersons;
      if (opt.debug) logger.info('New persons read');
      if (opt.debug) logger.info('New persons:', newPersons.length);
      csv()
      .fromFile(oldPersonsPath)
      .then((innerOldPersons) => {
        oldPersons = innerOldPersons;
        logger.info('Old persons read done');
        // For each new object, check if it exists in the old object based on the "id" field.
        // If it doesn't exist, add it to the delta object.
        deltaPersons = newPersons.filter((newItem) => {
          let isNew = !oldPersons.find((oldItem) => oldItem["id"] === newItem["id"] && oldItem["full-name"] === newItem["full-name"]);
          //if isNew or the grant has been updated
          if (isNew) {
            logger.info('New Person:', newItem["full-name"] + ' / ' + newItem["id"]);
            return true;
          }
          else {
            let oldItem = oldPersons.find((oldItem) => oldItem["id"] === newItem["id"] && oldItem["full-name"] === newItem["full-name"]);
            let isUpdated = false;
            // For each oldItem key, check if it is different from the newItem key
            // If isUpdated is true, return true
            for (let key in oldItem) {
              if (oldItem[key] !== newItem[key]) {
                logger.info('Updated Person: ' + oldItem["id"] + ' / ' + oldItem["full-name"] + ' Old:' + key, oldItem[key]);
                logger.info('Updated Person: ' + newItem["id"] + ' / ' + newItem["full-name"] + ' New:' + key, newItem[key]);
                isUpdated = true;
              }
            }
            return isUpdated;
          }
        });
        resolve();
      });
    }
  );
});
}

// Add any grant that is referenced in the deltaLinksArray but not in the grants to the deltaGrants array
// For each id-1 in the linksArray, check if it exists in the deltaGrants array
async function addGrantsLinked() {
  return new Promise((resolve) => {
    for (let i = 0; i < deltaLinks.length; i++) {
      if (!deltaGrants.find((grant) => grant["id"] === newLinks[i]["id-2"])) {
        if (newGrants.find((grant) => grant["id"] === newLinks[i]["id-2"])) {
          let grant = newGrants.find((grant) => grant["id"] === newLinks[i]["id-2"]);
          deltaGrants.push(grant);
          logger.info('New grant linked:', grant["id"]);
        }
      }
    }
    resolve();
  });
}

// Add all links in newLinks to deltaLinks that reference a grant in the deltaGrants array
// For each id-2 in the linksArray, check if it exists in the deltaGrants array
async function addLinks() {
  return new Promise((resolve, reject) => {
    if (opt.debug) logger.info('New links:', newLinks.length);
    if (opt.debug) logger.info('Delta grants:', deltaGrants.length);
    if (opt.debug) logger.info('Delta links:', deltaLinks.length);

    for (let i = 0; i < newLinks.length; i++) {
      if (deltaGrants.find((grant) => grant["id"] === newLinks[i]["id-2"])) {
        deltaLinks.push(newLinks[i]);
        logger.info('New link added:', newLinks[i]["id-1"] + ' / ' + newLinks[i]["id-2"]);
      }
    }
    resolve();
  });
}



// Add any user link that references a grant included in the deltaGrants array
async function addUserLinks() {
  return new Promise((resolve, reject) => {
    for (let i = 0; i < deltaGrants.length; i++) {
      // if no matching grant in the deltaLinks array
      if (!deltaLinks.find((link) => link["id-2"] === deltaGrants[i]["id"])) {
        logger.info('No user link for:', deltaGrants[i]["id"]);
        // get the link from the oldLinks array
        logger.info('Checking for new user link for:', deltaGrants[i]["id"]);
        if (newLinks.find((link) => link["id-2"] === deltaGrants[i]["id"])) {
          let link = newLinks.find((link) => link["id-2"] === deltaGrants[i]["id"]);
          deltaLinks.push(link);
          logger.info('New user link added for:', deltaGrants[i]["id"]);
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
      if (!deltaGrants.find((grant) => grant["id"] === newPersons[i]["id"])) {
        // get the grant from the newGrants array
        if (newGrants.find((grant) => grant["id"] === newPersons[i]["id"])) {
          // and add it to the deltaGrants array
          let grant = newGrants.find((grant) => grant["id"] === newPersons[i]["id"]);
          deltaGrants.push(grant);
          logger.info('New grant of person:', grant["id"]);
        }
      }
    }
    resolve();
  });
}

async function executeInOrder() {
  await readGrants(); // read the new and old grants files
  await readLinks(); // read the new and old links files
  await getDeltaLinks(); // get the deltaLinks array
  await readPersons(); // read the new and old persons files
  await addGrantsLinked(); // add any grant that is referenced in the linksArray but not in the grants to the deltaGrants array
  await addLinks(); // add all links in newLinks to deltaLinks that reference a grant in the deltaGrants array
  await addUserLinks(); // add any user link that references a grant included in the deltaGrants array
  deleteLinks = await findDeletedLinks(); // find oldLinks that are not in newLinks
}

executeInOrder().then(async () => {
  logger.info('Delta-grants:', deltaGrants.length);
  // Write the delta object to a new CSV file.
  const deltaFilePath = opt.dir + '/delta/' + opt.prefix; // replace with your desired delta CSV file path
  let csvData = deltaGrants.map((item) => Object.values(item));
  let columns = Object.keys(deltaGrants[0]);
  const csvString = await new Promise((resolve, reject) => {
    stringify(csvData, { header: true, columns: columns  }, (err, output) => {
      if (err) {
        reject(err);
      } else {
        resolve(output);
      }
    });
  });

  fs.writeFileSync(deltaFilePath + 'grants_metadata.csv', csvString);

  // Write the deltaLinks object to a new CSV file.
  csvData = deltaLinks.map((item) => Object.values(item));
  columns = Object.keys(deltaLinks[0]);

  const csvStringLinks = await new Promise((resolve, reject) => {
    stringify(csvData, { header: true, columns: columns }, (err, output) => {
      if (err) {
        reject(err);
      } else {
        resolve(output);
      }
    });
  }
);

fs.writeFileSync(deltaFilePath + 'grants_links.csv', csvStringLinks);

logger.info('Delta-persons:', deltaPersons.length);

// Write the delta object to a new CSV file.
csvData = deltaPersons.map((item) => Object.values(item));
columns = Object.keys(deltaPersons[0]);
const csvStringPersons = await new Promise((resolve, reject) => {
  stringify(csvData, { header: true, columns: columns}, (err, output) => {
    if (err) {
      reject(err);
    } else {
      resolve(output);
    }
  });
});

fs.writeFileSync(deltaFilePath + 'grants_persons.csv', csvStringPersons);

// Write the delta object to a new CSV file.

csvData = deleteLinks.map((item) => Object.values(item));
// select the columns to fit the links_to_delete schema
columns = Object.keys(deleteLinks[0]);
const csvStringDeletes = await new Promise((resolve, reject) => {
  stringify(csvData, { header: true, columns: columns}, (err, output) => {
    if (err) {
      reject(err);
    } else {
      resolve(output);
    }
  });
});

fs.writeFileSync(deltaFilePath + 'delete_user_grants_links.csv', csvStringDeletes);

// Count deltaGrants that don't have a link
let count = 0;
for (let i = 0; i < deltaGrants.length; i++) {
  if (!deltaLinks.find((link) => link["id-2"] === deltaGrants[i]["id"])) {
    count++;
  }
}
logger.info('Delta grants without links:', count);

// Count newGrants that don't have a link
count = 0;
for (let i = 0; i < newGrants.length; i++) {
  if (!newLinks.find((link) => link["id-2"] === newGrants[i]["id"])) {
    count++;
  }
}
logger.info('New grants without links:', count);
});

