import cache from '../../cache.js';
import logger from '../../logger.js';
import {frame, frameExpert, simplifiedExpert} from './frame.js';

async function generateExpert(username) {
  logger.info(`Running AE webapp expert transformation for user: ${username}`);

  // Read the main expert graph
  const aeStdPerson = await cache.readUserAsset(username, 'ae-std/person.jsonld');
  const expertGraph = JSON.parse(aeStdPerson);

  const keycloak = await cache.readUserAsset(username, 'keycloak.json');
  const expertId = JSON.parse(keycloak).attributes.expertId[0];

  // Frame the expert graph to webapp format
  const framed = await frameExpert(expertId, expertGraph);

  return framed;
}

async function generateSimplifiedExpert(username) {
  logger.info(`Running AE webapp simplified expert transformation for user: ${username}`);

  // Read the main expert graph
  const aeStdPerson = await cache.readUserAsset(username, 'ae-std/person.jsonld');
  const expertGraph = JSON.parse(aeStdPerson);

  // Frame the expert graph to webapp format
  const framed = await frame(expertGraph);

  return simplifiedExpert(framed);
}

export {
  generateExpert,
  generateSimplifiedExpert
}