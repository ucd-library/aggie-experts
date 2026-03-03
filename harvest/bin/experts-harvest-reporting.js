import { Command } from 'commander';
import { exec } from 'child_process';
import config from '../lib/config.js';
import fs from 'fs';
import path from 'path';
import { cleanup } from '../lib/reporting/index.js';

const DEFAULT_FILE = 'etl_reporting.dump';
const SCHEMA = 'etl_reporting';

const program = new Command();

program
  .command('clean')
  .description('clean the reporting database')
  .option('-u, --users <number>', 'number of weeks to keep in the database', parseInt)
  .option('-c, --commands <number>', 'number of weeks to keep in the database', parseInt)
  .option('--yes', 'Skip confirmation prompt')
  .action(async (options) => {
    if (!options.users && !options.commands) {
      console.error('Please specify at least one of --users or --commands with the number of weeks to keep.');
      return;
    }

    if( options.users ) {
      console.log(`This will delete user cache entries older than ${options.users} weeks.`);
    }
    if( options.commands ) {
      console.log(`This will delete command entries older than ${options.commands} weeks.`);
    }

    if (!options.yes) {
      const readline = (await import('readline')).createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        readline.question('\nAre you sure you want to clean the reporting database? This will permanently delete data. (yes/no) ', (ans) => {
          readline.close();
          resolve(ans);
        });
      });

      if (answer.toLowerCase() !== 'yes') {
        console.log('Aborting cleanup.');
        return;
      }
    }

    let resp = await cleanup({users: options.users, commands: options.commands});
    console.log('Cleanup response:', resp);
  });

program
  .command('dump')
  .description('dump the reporting database')
  .option('-f, --file <file>', 'output file. Default to local dir and etl_reporting.dump')
  .action(async (options) => {
    let { file } = options;
    file = file || path.join(process.cwd(), DEFAULT_FILE);

    if (fs.existsSync(file) && fs.lstatSync(file).isDirectory()) {
      file = path.resolve(file, DEFAULT_FILE);
    }

    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const pgDumpCommand = `pg_dump -U ${config.postgres.user} -h ${config.postgres.host} -d ${config.postgres.database} --schema=${SCHEMA} -Fc -f ${file}`;
    console.log(`Executing command: ${pgDumpCommand}\n`);

    exec(pgDumpCommand, {
        env : {
          PGPASSWORD: process.env.PGPASSWORD || config.postgres.password
        }
      }, 
      (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing pg_dump: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`pg_dump stderr: ${stderr}`);
        return;
      }
      console.log(`pg_dump stdout: ${stdout}`);
    });
  });

program
  .command('restore')
  .description('restore the reporting database')
  .option('-f, --file <file>', 'input file. Default to local dir and etl_reporting.dump')
  .action(async (options) => {
    let { file } = options;
    file = file || path.join(process.cwd(), DEFAULT_FILE);

    if( !fs.existsSync(file) ) {
      console.error(`Input file does not exist: ${file}`);
      return;
    }

    await exec_wrapper(`psql -U ${config.postgres.user} -h ${config.postgres.host} -d ${config.postgres.database} -n ${SCHEMA} -c "DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;"`)


    const pgRestoreCommand = `pg_restore -U ${config.postgres.user} -h ${config.postgres.host} -d ${config.postgres.database} ${file}`;
    await exec_wrapper(pgRestoreCommand);
  });


function exec_wrapper(command) {
  let options = {
    env: {
      PGPASSWORD: process.env.PGPASSWORD || config.postgres.password
    }
  }

  return new Promise((resolve, reject) => {
    console.log(`Executing command: ${command}\n`);

    const child = exec(command, options);
    if (child.stdout) child.stdout.pipe(process.stdout);
    if (child.stderr) child.stderr.pipe(process.stderr);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Command '${command}' exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

program.parse(process.argv);