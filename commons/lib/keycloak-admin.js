//Import keycloak-admin-client
import KcAdminClient from '@keycloak/keycloak-admin-client';
import GoogleSecret from './google-secret.js';
import logger from './logger.js';
import config from './config.js';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 8);

export default class ExpertsKcAdminClient {

  async authenticate() {
    if (this.authenticated) {
      return;
    }
    if( this.authenticating ) {
      await this.authenticating;
      return;
    }
    this.authenticating = this._authenticate();
    await this.authenticating;
    delete this.authenticating;
    this.authenticated = true;
  }

  async _authenticate() {
    await GoogleSecret.loadKeycloakSecrets();

    this.kcadmin = new KcAdminClient({
        baseUrl: config.oidc.host,
        realmName: config.oidc.clients.admin.realm
    })
    try {
      await this.kcadmin.auth({
        grantType: 'client_credentials',
        clientId: config.oidc.clients.admin.clientId,
        clientSecret: config.oidc.clients.admin.secret,
      });
    } catch (e) {
      logger.error('Error getting keycloak authorized', e);
      process.exit(1);
    }
  }

  mintExpertId() {
    return nanoid();
  }

  /**
   * List all users
   * @returns {Promise} a promise that will resolve with the list of users
   */
  async list() {
    await this.authenticate();
    return this.kcadmin.users.find({enabled: true, briefRepresentation: false, max: 10000});
  }

  /**
   * User count
   * @returns {Promise} a promise that will resolve with the number of users
   */
  async count() {
    await this.authenticate();
    return this.kcadmin.users.count();
  }

  /**
   * Find user(s) by attribute
   * @param {string} - attribute:value
    * @returns {Promise} - The user(s) with the attribute
   */
  async findByAttribute(keyVal) {
    await this.authenticate();
    try {
      const q_req = await this.kcadmin.users.makeRequest(
        {
          method: 'GET',
          payloadKey: "q"
        }
      );
      const users = await q_req(
        {
            q: keyVal
        }
      );
      return users;
    } catch (error) {
      throw error;
    }
  }

    /**
   * Find one user by attribute
   * @param {string} - attribute:value
   * @returns {Promise} - The user with the attribute
   * @throws {Error} - If multiple users are not found
   */
  async findOneByAttribute(keyVal) {
    try {
      const users = await this.findByAttribute(keyVal);
      if (users.length > 1) {
        throw new Error('Multiple users found');
      }
      return users[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify the expertId of a user
   * @param {object} user - The user object to verify
   * @returns {Promise} - The user object with a verified expertId
   */
  async verifyExpertId(user,expertId) {
    await this.authenticate();
    const users = await this.findByAttribute(`expertId:${expertId}`);
    //if multiple users are found
    if (users.length > 1) {
      //throw new Error(`Multiple users found with expertId: ${expertId}`);
      const attributes = user.attributes || {};
      attributes.expertId = this.mintExpertId();
      await this.kcadmin.users.update({id:user.id},{attributes});
      return this.verifyExpertId(user,attributes.expertId);
    }
    //if no users are found
    if (users.length === 0) {
      throw new Error(`No users found with expertId: ${expertId}`);
    }
    //if one user is found
    if (users.length === 1) {
      if (users[0].id === user.id) {
         return users[0];
      } else {
        throw new Error(`User with expert:${expertId} ${users[0].id} != ${userId}`);
      }
    }
  }

  async update(user,update) {
    await this.authenticate();
    return this.kcadmin.users.update(user,update);
  }

    /**
     * Create a new expert
     * @param {object} profile - The usr's iam profile
     * @returns {Promise} - The user object created
     */
  async createExpert(email, profile) {
    if( profile ) {
      // profile = {
      //   firstName: p.oFirstName,
      //   lastName: p.oLastName,
      //   attributes: {
      //     ucdPersonUUID: p.mothraId,
      //     iamId: p.iamId
      //   }
    }

    await this.authenticate();
    //try to create a new user
    try {
      //create a new user with the username=IDP.email, and link the user to the IDP
      const expertId = this.mintExpertId();
      profile.attributes ||= {};
      profile.attributes.expertId = expertId;
      logger.info(`Creating new Keycloak user with email ${email} and expertId ${expertId}`);
      const userId = await this.kcadmin.users.create(profile);
      let user = await this.verifyExpertId(userId,expertId);
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * @method findByEmail
   * @description Find a user by IDP email. If the user email is found in keycloak
   * but the user does not have an expertId, this function will mint a new expertId 
   * and patch the user. 
   * 
   * @param {string} email - The email of the user
   * @param {Object} attributes - Attributes to use if a patch is required
   * 
   * @returns {Promise} - A promise that resolves with the user object
   */
  async findByEmail(email, attributes={}) {
    await this.authenticate();

    //get the users from keycloak
    const users = await this.kcadmin.users.find({
      email: email,
      exact: true
    });

    if (users.length === 0) {
      throw new Error(`No keycloak user found with email: ${email}`);
    }

    if( users[0]?.attributes?.expertId === undefined ) {
      // throw new Error(`Keycloak user with email ${email} does not have an expertId`);
      logger.warn(`Keycloak user with email ${email} does not have an expertId, minting a new one`);
      const user = users[0];

      if( !user.attributes ) user.attributes = {};
      for( let [key, value] of Object.entries(attributes) ) {
        user.attributes[key] = value;
      }
      user.attributes.expertId = this.mintExpertId();
      
      await this.kcadmin.users.update(
        {id: user.id},
        {
          email: user.email,
          attributes: user.attributes,
          firstName: user.firstName,
          lastName: user.lastName
        }
      );
    }

    return users[0];
  }

  /**
   * @method getOrCreateExpert
   * @description Find a user by IDP email, or create a new user if the user does not exist.
   * @param {string} email - The email of the user
   * @param {Object} username - The IDP userName
   * @returns {Promise} - A promise that resolves with the user expertId
   */
  async getOrCreateExpert(email, username, profile) {
    let user;
    try {
      user = await this.findByEmail(email, profile.attributes);
    } catch (error) {
      if( error.response?.status >= 400 ) {
        throw new Error(`Could not access Keycloak to find user with email: ${email}. Status = ${error.response.status}, Message = ${error.response.statusText}`, );
      } else if (username && profile) {
        user = await this.createNewExpert(email, username, profile);
      } else {
        throw error;
      }
    }
    return user;
  }

  async createNewExpert(email, username, profile) {
    logger.info(`Creating new Keycloak expert for email: ${email}, username: ${username}`);
    const new_user = {
      email: email,
      username: email,
      emailVerified: true,
      enabled: true,
      federatedIdentities: [{
        identityProvider: "cas-oidc",
        userId: username,
        userName: username
      }]
    };

    ['firstName','lastName','attributes'].forEach((key) => {
      if (profile[key]) {
        new_user[key] = profile[key];
      }
    });

    let user = await this.createExpert(email, new_user);
    return user;
  }

  async generateServiceAccountToken(opts={}) {
    let {serviceName, username, password, realm} = opts;
    let url;

    if( !serviceName && !(username && password && realm) ) {
      throw new Error('serviceName, username, password, and realm are required to generate a service account token');
    }

    if( serviceName ) {
      if( !config.oidc.clients[serviceName] ) {
        throw new Error(`Service ${serviceName} not found in config.oidc.clients`);
      }
      let service = config.oidc.clients[serviceName];

      await GoogleSecret.loadKeycloakSecrets();
      realm = service.realm;
      username = service.clientId;
      password = service.secret;
    }

    url = `${config.oidc.host}/realms/${realm}/protocol/openid-connect/token`;

    logger.debug(`Requesting service account token from Keycloak at ${url} for client ${username}`);

    let apiResp = await fetch(url, {
      method: 'POST',
      headers:{
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type : 'client_credentials',
        client_id : username,
        client_secret : password,
        scope : opts.scopes || config.oidc.scopes
      })
    });

    let json = await apiResp.json();

    return {
      body : json,
      status : apiResp.status
    }
  }
}
