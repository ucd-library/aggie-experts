#! /usr/bin/env -S node --no-warnings
'use strict';
import path from 'path';
import fs from 'fs-extra';
import { Command } from '../lib/experts-commander.js';

import { GoogleSecret, ExpertsKcAdminClient } from '@ucd-lib/experts-api';
import { performance } from 'node:perf_hooks';

const program = new Command();
const gs = new GoogleSecret();

async function main(opt) {

  //  get keycloak token
  let keycloak_admin
  try {
    const keycloakResp=await gs.getSecret('projects/325574696734/secrets/service-account-harvester')
    const keycloak = JSON.parse(keycloakResp);

    keycloak_admin = new ExpertsKcAdminClient(
      {
      baseUrl: keycloak.baseUrl,
      realmName: keycloak.realmName
      },
    );

    await keycloak_admin.auth(keycloak.auth);
    opt.log.info('Keycloak admin client authenticated');
  } catch (e) {
    opt.log.error('Error getting keycloak authorized', e);
    process.exit(1);
  }


  function getValue(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (let key of keys) {
      if (/\[\d+\]/.test(key)) { // if the key includes an index, e.g., [0]
        const index = parseInt(key.match(/\d+/)[0]);
        const arrKey = key.split('[')[0];
        value = value[arrKey][index];
      } else {
        value = value[key];
      }

      if (value === undefined) return undefined; // if any key is not found, return undefined
    }

    return value;
  }

  if (opt.count) {
    const count = await keycloak_admin.count();
    console.log(count);
    return;
  }

  if (opt.users) {
    const users = await keycloak_admin.list();
    console.log(JSON.stringify(users));
//    users.forEach(user => {
//      console.log(user.username);
//    });
    return;
  }

  const experts = program.args;
  for (let expert of experts) {
    opt.log.info(`Processing expert ${expert}`);
    let user
    try {
      if (expert.match(/^(expertId|ucdPersonUUID):/)) {
        console.log(`Fetching expert by attribute ${expert}`);
        user = await keycloak_admin.findByAttribute(expert);
        console.log(user);
      } else {
        // if email is a email:cas pair seperated by a colon, split it
        const email = expert;
        user = await keycloak_admin.findByEmail(email);
//        user = await keycloak_admin.getOrCreateExpert(email);
      }
      if (user) {
        if (opt.add) {
          let profile;
          let updates = {attributes: user.attributes || {}};
          try {
            opt.log.info(`Fetching ${user.id}`);
            profile=await opt.iam.profile({"email":user.email});
            opt.log.info({measure:`iam(${expert})`},`► ◄ iam(${expert})`);
          } catch (e) {
            opt.log.error({measure:`iam(${expert})`,error:e.message,user},`►E◄ iam(${expert})`);
          }
          profile=profile["@graph"][0];
          opt.add.forEach((key)=>{
            let [path,attr]=key.split(':');
            if (!attr) { attr=path; }
            const value = getValue(profile, path);
            if (value) {
              updates.attributes[attr]=[value];
            }
          });
          try {
            await keycloak_admin.update({id:user.id},updates);
            opt.log.info({email:user.email, updates},`update(${user.email},${updates})`);
          } catch (e) {
            opt.log.error({error:e.message},`►E◄ update(${user.email})`);
          }
        }
        console.log(JSON.stringify(user));
      } else {
        console.log(`User not found: ${expert}`);
      }

    } catch (e) {
      opt.log.error(`Failed on ${expert}: ${e.message}`);
    }
  }
}

performance.mark('start');
program.name('experts-keycloak')
  .usage('[options] <users...>')
  .description('Search / Update Keycloak users')
  .option('-c, --count', 'Count users')
  .option('-u, --users', 'List users')
  .option('--add <ucdid_path:attribute...>', 'Add a user attribute into keycloak.  ucdid_path is the json path to the ucdid in the user object.  attribute is the keycloak attribute to add.')
  .option_iam()
  .option_log()

program.parse(process.argv);

let opt = program.opts();

await main(opt);
