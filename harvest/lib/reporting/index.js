import config from '../config.js';

async function reportFileWrite(opts={}) {
  if( !config?.reporting?.enabled ) {
    return;
  }

  const job_id = config.reporting.jobId;
  const { step, user_id, file_path, last_modified, file_hash, last_file_hash, no_op } = opts;


  console.log('Reporting file write:', {
    job_id,
    step,
    user_id,
    file_path,
    last_modified,
    file_hash,
    last_file_hash,
    no_op
  });
}

export {
  reportFileWrite
}