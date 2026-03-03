import {createLogger} from '@ucd-lib/logger';
import config from '../../commons/config.js';

const logger = createLogger({
  name : false,
  noInitMsg : true,
  hostname : false,
  labelsProperties : []
});

export default logger;