#!/usr/bin/env node
/**
 * experts harvest grant-feed-process
 *
 * Orchestrates the full grant-feed ETL: build two generations of CSVs from
 * the Aggie Enterprise XML feed, diff them into delta files, and (optionally)
 * SFTP the delta files to the Symplectic Elements server.
 *
 * Replaces the old grants-import/bin/experts-grant-feed-process.js. Kept as
 * a thin wrapper that spawns the other two CLIs so the steps can be run
 * independently (or wired into Dagster one asset at a time).
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import Client from 'ssh2-sftp-client';
import { logger, GoogleSecret } from '@ucd-lib/experts-commons';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('experts-harvest-grant-feed-process')
  .description('Run the full AE grant-feed ETL: transform two generations, diff, and (optionally) upload to Symplectic')
  .version('1.0.0')
  .option('--env <env>', 'QA | PROD (controls Prod_UCD_ filename prefix)', 'PROD')
  .requiredOption('--xml <xml>', 'Source XML file (local path or gs://...)')
  .requiredOption('-o, --output <output>', 'Working directory for generated CSVs')
  .option('-n, --new <new>', 'Generation id treated as the new feed', '0')
  .option('-p, --prev <prev>', 'Generation id treated as the previous feed', '1')
  .option('--upload', 'SFTP the delta files to Symplectic on completion', false)
  .option('-h, --host <host>', 'SFTP host', 'ftp.use.symplectic.org')
  .option('-u, --username <username>', 'SFTP username', 'ucdavis')
  .option('--secret-name <secret>', 'Secret Manager key holding the SFTP password', 'Symplectic-Elements-FTP-ucdavis-password')
  .action(async (opts) => {
    fs.mkdirSync(opts.output, { recursive: true });
    const prefix = opts.env === 'PROD' ? 'Prod_UCD_' : '';

    const transformCli = path.join(__dirname, 'experts-harvest-grant-feed.js');
    const deltaCli = path.join(__dirname, 'experts-harvest-grant-feed-delta.js');

    runChild(transformCli, [
      '--env', opts.env,
      '--xml', opts.xml,
      '--generation', opts.new,
      '--output', opts.output
    ]);

    runChild(transformCli, [
      '--env', opts.env,
      '--xml', opts.xml,
      '--generation', opts.prev,
      '--output', opts.output
    ]);

    runChild(deltaCli, [
      '--env', opts.env,
      '--output', opts.output,
      '--new', opts.new,
      '--prev', opts.prev
    ]);

    if (opts.upload) {
      await uploadDeltaToSymplectic(opts, prefix);
    }
  });

function runChild(script, args) {
  logger.info(`spawn: ${script} ${args.join(' ')}`);
  const result = spawnSync('node', [script, ...args], {
    stdio: 'inherit',
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(`${path.basename(script)} exited with status ${result.status}`);
  }
}

async function uploadDeltaToSymplectic(opts, prefix) {
  const password = await GoogleSecret.getSecret(opts.secretName);
  const sftp = new Client();
  try {
    await sftp.connect({
      host: opts.host,
      port: 22,
      username: opts.username,
      password
    });

    const uploads = [
      'grants_metadata.csv',
      'grants_links.csv',
      'grants_persons.csv',
      'delete_user_grants_links.csv'
    ];
    for (const name of uploads) {
      const local = path.join(opts.output, 'delta', `${prefix}${name}`);
      const remote = `/${opts.env}/${prefix}${name}`;
      logger.info(`SFTP put ${local} -> ${remote}`);
      await sftp.put(fs.createReadStream(local), remote);
    }
  } finally {
    await sftp.end();
  }
}

program.parseAsync(process.argv).catch(err => {
  logger.error('grant-feed process failed', err);
  process.exit(1);
});
