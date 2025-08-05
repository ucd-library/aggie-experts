import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import config from './config.js';
export class GoogleSecret {

  constructor() {
    this.client = new SecretManagerServiceClient({
      keyFilename: config.userConfig.serviceAccountFile
    });
  }

  async accessSecretVersion(name) {
    const [version] = await this.client.accessSecretVersion({
      name: name + '/versions/latest',
    });

    // Extract the payload as a string.
    const payload = version.payload.data.toString();

    // WARNING: Do not print the secret in a production environment - this
    // snippet is showing how to access the secret material.
    // console.log(`Payload: ${payload}`);
    return payload;
  }

  async getSecret(name) {
    let useSecretCache = config.userConfig.get('useSecretCache', false);
    if( useSecretCache ) {
      let cachedSecret = config.userConfig.get('googleSecrets', {})[name];
      if (cachedSecret) {
        return cachedSecret;
      }
    }

    const [secret] = await this.client.getSecret({
      name: name,
    });

    let value = await this.accessSecretVersion(name);

    if ( useSecretCache ) {
      let userConfig = config.userConfig.get('googleSecrets', {});
      userConfig[name] = value;
      config.userConfig.set('googleSecrets', userConfig);
    }

    return value;
  }
}

export default GoogleSecret;
