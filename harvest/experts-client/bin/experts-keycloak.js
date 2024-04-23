#! /usr/bin/env -S node --no-warnings
'use strict';
import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import { GoogleSecret } from '@ucd-lib/experts-api';
import { logger } from '../lib/logger.js';
import { performance } from 'node:perf_hooks';
import ExpertsKcAdminClient from '../lib/keycloak-admin.js';


const program = new Command();

async function main(opt) {

  if ( ! opt.clientSecret ) {
    throw new Error('client-secret is required');
  }
  
  const admin = new ExpertsKcAdminClient(
    {
      baseUrl: opt.keycloakUrl,
      realmName: opt.realmName,
    },
  );

  await admin.auth(
    {
      grantType: 'client_credentials',
      clientId: opt.clientId,
      clientSecret: opt.clientSecret
    }
  );

  //const profile = await admin.users.getProfile();
  //console.log(profile);
  
  const experts = program.args;
  for (let expert of experts) {
    try {
      if (expert.match(/^expertId:/)) {
        expert = expert.replace(/^expertId:/, '');
        const user = await admin.findByExpertId(expert);
        console.log(user);
      } else {
        // if email is a email:cas pair seperated by a colon, split it
        let [email,cas] = expert.split(':');      
        console.log(`finding user with email: ${email}`);
        let user= await admin.findByEmail(email);
        if (user) {
          console.log(user);
        } else {
          if (cas && opt.create) {
            const idp = {
              userName: cas,
              userId: cas
            };
            console.log(`user not found, creating user with email: ${email} and cas: ${cas}`);
            user=await admin.createByIDP(email,idp);
            console.log(user);
          } else {
            console.log(`${email} not found`);
          }
        }
      }
    } catch (e) {
      logger.error(`Failed on ${expert}: ${e.message}`);
    }
  }
}

performance.mark('start');
program.name('experts-keycloak')
  .usage('[options] <users...>')
  .description('Search / Update Keycloak users')
    .option('--keycloak-url <keycloak-url>', 'Keycloak URL', 'https://auth.library.ucdavis.edu')
    .option('--realm-name <keycloak-realm>', 'Keycloak realm', 'aggie-experts')
    .option('--client-id <client-id>', 'Keycloak client id', 'local-dev')
  .option('--client-secret <client-secret>', 'Keycloak client secret')
  .option('--create', 'Create user',false)

program.parse(process.argv);

let opt = program.opts();

logger.info({ opt }, 'options');
await main(opt);
