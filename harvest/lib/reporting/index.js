import config from '../config.js';
import PgClient from '../pg-client.js';

function reportFileWrite(opts={}) {
  if( !config?.reporting?.enabled ) {
    return;
  }
  opts.command_id = config.reporting.commandId;
  return config.postgres.client.insertFileCacheOp(opts);
}

function captureError(error) {  
  return config.postgres.client.insertError({
    message : error.message,
    stack : error.stack,
    command_id : config.reporting.commandId
  });
}

function updateEsIndex(alias, indexName, docCount) {
  return config.postgres.client.updateEsIndex(alias, indexName, docCount);
}

function captureErrors() {
  process.on('uncaughtException', async (err) => {
    await captureError(err);
    await config.postgres.client.end();

    console.error(err);
    process.exit(1);
  });
  process.on('unhandledRejection', async (reason, promise) => {
    await captureError(reason);
    await config.postgres.client.end();

    console.error(reason);
    process.exit(1);
  });
}

async function enableFromCli(command, user, options) {
  config.reporting.enabled = true;
  config.reporting.jobId = options.reportingJobId || config.reporting.jobId;
  config.reporting.command = command;
  config.reporting.opts = options;
  config.reporting.userId = user;
  config.postgres.client = new PgClient();
  let commandId = await config.postgres.client.insertCommand({
    job_id: config.reporting.jobId,
    command: config.reporting.command,
    user_id: config.reporting.userId,
    options: config.reporting.opts
  });
  config.reporting.commandId = commandId;
  captureErrors();
}


export {
  enableFromCli,
  reportFileWrite,
  captureErrors,
  updateEsIndex
}