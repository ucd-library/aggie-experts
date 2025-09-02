import { Command } from 'commander';
import { exec } from 'child_process';
import config from '../lib/config.js';
import fs from 'fs';
import path from 'path';

const DEFAULT_FILE = 'etl_reporting.dump';
const SCHEMA = 'etl_reporting';

const program = new Command();

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