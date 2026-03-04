import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import config from './config.js';
import { logger } from './logger.js';

class GoogleSecret {

  constructor() {
    logger.debug('Initializing Google Secret Manager client with credentials from', config.google.applicationCredentials);
    this.client = new SecretManagerServiceClient({
      keyFilename: config.google.applicationCredentials
    });

    this.cache = new Map();
  }

  async loadKeycloakSecrets() {
    let secret = await this.getSecret(config.google.secrets.keycloakSecrets);
    let secrets = JSON.parse(secret);

    // update config with secrets
    for( let key in config.oidc.clients ) {
      let client = config.oidc.clients[key];
      let secret = secrets?.realms?.[client.realm]?.[client.clientId]?.secret;
      if( secret ) {
        client.secret = secret;
      } else {
        logger.warn(`No secret found for ${client.realm}/${client.clientId} in keycloak secrets`);
      }
    }

    return secrets;
  }

  async accessSecretVersion(name) {
    const [version] = await this.client.accessSecretVersion({
      name: name + '/versions/latest',
    });

    return version.payload.data.toString();
  }

  async getSecret(name, opts={}) {
    let version = opts.version || 'latest';
    let cacheKey = `${name}/${version}`;
    name = `projects/${config.google.projectId}/secrets/${name}`;


    if( config.google.cacheSecrets && this.cache.has(cacheKey) ) {
      logger.debug(`Cache hit for secret: ${name}`);
      return this.cache.get(cacheKey);
    }

    logger.debug(`Accessing secret: ${name} from Google Secret Manager`);
    let value = await this.accessSecretVersion(name, version);

    if ( config.google.cacheSecrets ) {
      this.cache.set(cacheKey, value);
    }

    return value;
  }
}

const inst = new GoogleSecret();
export default inst;
