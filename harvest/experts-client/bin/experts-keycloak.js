#! /usr/bin/env -S node --no-warnings
'use strict';
import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import { GoogleSecret ExpertsKcAdminClient } from '@ucd-lib/experts-api';
import { logger } from '../lib/logger.js';
import { performance } from 'node:perf_hooks';

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
    let user
    try {
      if (expert.match(/^expertId:/)) {
        user = await admin.findByAttribute(expert);
        console.log(user);
      } else {
        // if email is a email:cas pair seperated by a colon, split it
        let [email,cas] = expert.split(':');
        if ( cas && opt.create) {
          user = await admin.getOrCreateExpert(email, cas);
        } else {
          user = await admin.findByEmail(email);
        }
        if (user) {
          console.log(user);
        } else {
          console.log(`User not found: ${expert}`);
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
