//Import keycloak-admin-client
import KcAdminClient from '@keycloak/keycloak-admin-client';
import GoogleSecret from './google-secret.js';
import { logger } from './logger.js';
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
    this.authenticating = null;
    this.authenticated = true;
  }

  async _authenticate() {
    await GoogleSecret.loadKeycloakSecrets();

    logger.info(
      'Initializing Keycloak Admin Client with:', 
      {baseUrl: config.oidc.host, 
      realmName: config.oidc.clients.admin.realm, 
      clientId: config.oidc.clients.admin.clientId
    });

    if( !this.kcadmin ) {
      logger.debug('Creating new Keycloak Admin Client instance');
      this.kcadmin = new KcAdminClient({
          baseUrl: config.oidc.host,
          realmName: config.oidc.clients.admin.realm
      })
    }

    try {
      logger.info('Authenticating Keycloak Admin Client');
      await this.kcadmin.auth({
        grantType: 'client_credentials',
        clientId: config.oidc.clients.admin.clientId,
        clientSecret: config.oidc.clients.admin.secret,
      });

      if (this._refreshTimer) clearInterval(this._refreshTimer);
      this._refreshTimer = setInterval(() => {
        this.authenticated = false;
        this.authenticating = null;
      }, 23 * 60 * 60 * 1000);

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
      // Flag this as a genuine "no user with this email" result so callers can
      // distinguish it from auth/token/network errors. Only this case may lead to
      // creating a new expert; other failures must never fall through to creation.
      const err = new Error(`No keycloak user found with email: ${email}`);
      err.notFound = true;
      throw err;
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
    try {
      return await this.findByEmail(email, profile.attributes);
    } catch (error) {
      // Only a genuine "no user with this email" result (error.notFound) may proceed
      // toward creation. Any other error — auth/token failures, network errors, HTTP
      // errors — must be surfaced, never swallowed as "not found", because falling
      // through on a transient failure mints a duplicate expert.
      if( !error.notFound ) {
        if( error.response?.status >= 400 ) {
          throw new Error(`Could not access Keycloak to find user with email: ${email}. Status = ${error.response.status}, Message = ${error.response.statusText}`, );
        }
        throw error;
      }
    }

    // No Keycloak user matched this email. The IAM email can change over time (e.g. a
    // corrected address), and matching on email alone would create a duplicate expert
    // for a person who already exists. Before creating, try to find the existing expert
    // by a stable IAM identifier (iamId, then ucdPersonUUID).
    const existing = await this.findByStableId(profile?.attributes);
    if( existing ) {
      await this.reconcileExpert(existing, email, profile?.attributes);
      return existing;
    }

    if (username && profile) {
      return this.createNewExpert(email, username, profile);
    }
    throw new Error(`No keycloak user found with email: ${email}`);
  }

  /**
   * @method findByStableId
   * @description Find an existing expert when the email lookup missed. Neither IAM
   * identifier is guaranteed stable — iamId can change while ucdPersonUUID holds, and
   * vice versa — so we try both: whichever one did NOT change is what still links the
   * new profile to the existing account. Any identifier that did change is reconciled
   * afterwards in reconcileExpert. Only if BOTH changed (no linkage possible) do we fall
   * through to creating a new expert.
   * @param {Object} attributes - profile attributes, e.g. {iamId, ucdPersonUUID}
   * @returns {Promise<Object|undefined>} the existing user, or undefined if none match
   */
  async findByStableId(attributes={}) {
    await this.authenticate();
    for( const key of ['iamId', 'ucdPersonUUID'] ) {
      const value = attributes?.[key];
      if( !value ) continue;
      const users = await this.findByAttribute(`${key}:${value}`);
      if( users.length === 0 ) continue;
      if( users.length > 1 ) {
        // Pre-existing duplicates — warn for manual clean-up, do not auto-merge.
        logger.warn(`Multiple Keycloak users found with ${key}:${value} (ids: ${users.map(u => u.id).join(', ')}). Using the first; manual de-duplication needed.`);
      }
      logger.info(`Matched existing Keycloak expert by ${key}:${value} (id: ${users[0].id}) after email lookup missed.`);
      return users[0];
    }
    return undefined;
  }

  /**
   * @method reconcileExpert
   * @description Given an existing expert matched by findByStableId, bring its mutable
   * fields into line with the current IAM profile. Because any of email, iamId, and
   * ucdPersonUUID can change over time, whichever ones differ are updated to the new
   * values (the one that matched simply won't differ). Username is left as-is per
   * policy. Also guarantees the account has an expertId. No-op if nothing changed.
   * @param {Object} user - the existing Keycloak user representation
   * @param {string} email - the current IAM email
   * @param {Object} attributes - current IAM profile attributes ({iamId, ucdPersonUUID})
   */
  async reconcileExpert(user, email, attributes={}) {
    await this.authenticate();
    const current = user.attributes || {};
    const changes = [];

    if( user.email !== email ) {
      changes.push(`email ${user.email} -> ${email}`);
    }

    // Sync any IAM identifier that drifted. Stored as arrays in Keycloak; incoming
    // profile values are scalars.
    for( const key of ['iamId', 'ucdPersonUUID'] ) {
      const next = attributes?.[key];
      if( next === undefined || next === null ) continue;
      const cur = Array.isArray(current[key]) ? current[key][0] : current[key];
      if( cur === next ) continue;

      // Collision guard: refuse to copy an identifier onto this account if it already
      // belongs to a DIFFERENT Keycloak account. That almost always signals a data
      // problem at the IAM source (two people sharing an id) — so leave the value 
      // unchanged and surface it loudly rather than creating an ambiguous duplicate 
      // identifier.
      const conflicts = (await this.findByAttribute(`${key}:${next}`))
        .filter(u => u.id !== user.id);
      if( conflicts.length ) {
        await this._reportIdentifierCollision({ user, key, from: cur, to: next, conflicts, email });
        continue;
      }

      changes.push(`${key} ${cur} -> ${next}`);
      current[key] = [next];
    }

    if( current.expertId === undefined ) {
      changes.push('minted missing expertId');
      current.expertId = [this.mintExpertId()];
    }

    if( changes.length ) {
      logger.warn(`Reconciling Keycloak expert (id: ${user.id}) matched by stable id: ${changes.join('; ')} (username left unchanged).`);
      await this.kcadmin.users.update(
        {id: user.id},
        {
          email,
          attributes: current,
          firstName: user.firstName,
          lastName: user.lastName
        }
      );
      user.email = email;
      user.attributes = current;
    }
    return user;
  }

  /**
   * @method _reportIdentifierCollision
   * @description Surface an attempt to move an IAM identifier onto an expert when it 
   * already belongs to a different Keycloak account. Logs at error severity and, when 
   * ETL reporting is enabled, records a validation_issue so it appears in the reporting 
   * dashboards (the same channel load-step data problems use) for follow-up with IAM. 
   * Never throws — a reporting failure must not abort the run.
   * @param {Object} opts
   * @param {Object} opts.user - the expert being reconciled
   * @param {string} opts.key - the identifier field (iamId | ucdPersonUUID)
   * @param {string} opts.from - the current stored value
   * @param {string} opts.to - the incoming IAM value that collides
   * @param {Array} opts.conflicts - other Keycloak accounts already holding `to`
   * @param {string} opts.email - the current IAM email (for context)
   */
  async _reportIdentifierCollision({ user, key, from, to, conflicts, email }) {
    const expertId = Array.isArray(user.attributes?.expertId)
      ? user.attributes.expertId[0]
      : user.attributes?.expertId;
    const conflictIds = conflicts.map(u => u.id).join(', ');
    const message =
      `IAM ${key} for expert ${expertId || user.id} (${email}) changed ${from} -> ${to}, ` +
      `but ${to} already belongs to Keycloak account(s) ${conflictIds}. Left ${key} ` +
      `unchanged; likely an IAM source data problem needing manual review.`;

    logger.error(`IDENTIFIER_COLLISION: ${message}`);

    if( config.reporting.enabled && config.postgres.client ) {
      try {
        await config.postgres.client.insertValidationIssue({
          command_id: config.reporting.commandId,
          user_id: config.reporting.userId,
          entity_type: 'expert',
          entity_id: expertId || user.id,
          issue_type: 'identifier_collision',
          field: key,
          message
        });
      } catch (err) {
        logger.error('Failed to record identifier_collision validation issue', err);
      }
    }
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

  async validateToken(token, opts={}) {
    // split apart the token and decode the header to get the realm
    let parts = token.split('.');
    if( parts.length !== 3 ) {
      throw new Error('Invalid token format');
    }

    let header = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

    let realm = header?.iss?.split('/realms/')?.[1];
    if( !realm ) {
      throw new Error('Invalid token header, missing realm in kid');
    }

    let url = `${config.oidc.host}/realms/${realm}/protocol/openid-connect/token/introspect`;

    logger.debug(`Validating token with Keycloak at ${url}`);

    await GoogleSecret.loadKeycloakSecrets();

    let apiResp = await fetch(url, {
      method: 'POST',
      headers:{
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.oidc.clients.admin.clientId}:${config.oidc.clients.admin.secret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        token: token,
        token_type_hint: 'access_token'
      })
    });

    let json = await apiResp.json();

    return {
      body : json,
      status : apiResp.status
    }
  }
}
