import cache from './cache.js';

async function setDeleteException(userId, reason) {
  await cache.write(userId, 'delete-exception.json', {reason});
}

async function removeDeleteException(userId) {
  await cache.delete(userId, 'delete-exception.json');
}

export default {
  setDeleteException,
  removeDeleteException
};