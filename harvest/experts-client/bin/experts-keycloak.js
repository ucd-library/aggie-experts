#! /usr/bin/env -S node --no-warnings
'use strict';
import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import { GoogleSecret, ExpertsKcAdminClient } from '@ucd-lib/experts-api';
import { logger } from '../lib/logger.js';
import { performance } from 'node:perf_hooks';

const program = new Command();

async function main(opt) {

  if ( ! opt.clientSecret ) {
    throw new Error('client-secret is required');
  }

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
  } catch (e) {
    logger.error('Error getting keycloak authorized', e);
    process.exit(1);
  }


  const experts = program.args;
  for (let expert of experts) {
    let user
    try {
      if (expert.match(/^(expertId|ucdPersonUUID):/)) {
        console.log(`Fetching expert by attribute ${expert}`);
        user = await keycloak_admin.findByAttribute(expert);
        console.log(user);
      } else {
        // if email is a email:cas pair seperated by a colon, split it
        let email = expert;
        user = await keycloak_admin.findByEmail(email);
      }
      if (user) {
        console.log(user);
      } else {
        console.log(`User not found: ${expert}`);
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

program.parse(process.argv);

let opt = program.opts();

logger.info({ opt }, 'options');
await main(opt);
