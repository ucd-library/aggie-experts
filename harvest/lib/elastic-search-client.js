import {Client} from '@elastic/elasticsearch';
import config from './config.js';
import logger from './logger.js';

let client;


function createClient() {
  if (client) {
    return client;
  }

  client = new Client({
    node: config.elasticsearch.connStr,
    auth: {
      username: config.elasticsearch.username,
      password: config.elasticsearch.password
    }
  });

  return client;
}

export default createClient;