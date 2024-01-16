#! /usr/bin/env -S node --no-warnings

import ElementsClient from '../lib/elements-client.js';

console.log(ElementsClient.info('qa'));

let ec = new ElementsClient({instance: 'qa'});
//let secret = await ec.secret();
//console.log(secret);
//let service_account = await ec.service_account();
//console.log(service_account);

let login = await ec.login();
console.log('stop')
//console.log(login);
