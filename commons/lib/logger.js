import {createLogger} from '@ucd-lib/logger';

const logger = createLogger({
  name : false,
  noInitMsg : true,
  hostname : false,
  labelsProperties : []
});

export default logger;