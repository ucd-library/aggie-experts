import config from './config.js';

function wrapUserDomain(user) {
  if( !user ) throw new Error('User object is required');

  if( !user.endsWith(config.userDomain) ) {
    return user + config.userDomain;
  }

  return user;
}

export default wrapUserDomain;