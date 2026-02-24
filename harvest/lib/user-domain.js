import config from './config.js';

function wrapUserDomain(user) {
  if( !user ) throw new Error('User object is required');

  if( !user.includes('@') ) {
    return user + config.userDomain;
  }

  return user;
}

export default wrapUserDomain;