import bunyan from 'bunyan';
import path from 'path';
import fs from 'fs';

const streams = [
  // Log to the console
  { stream: process.stdout }
];

const host = 'localhost'

export const logger = bunyan.createLogger({
  name: ('experts-client')+'-'+host,
  level: 'info',
  streams: streams
});

const info = {
  name: ('experts-client')+'-'+host,
  level: 'info',
  stackdriver : {
    enabled : false,
    file : null
  }
}

logger.info('logger initialized', info);
