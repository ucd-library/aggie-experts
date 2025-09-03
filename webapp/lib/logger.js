const {createLogger} = require('@ucd-lib/logger');

const logger = createLogger({
  name : 'aggie-experts',
  labelsProperties : []
});

module.exports = logger;