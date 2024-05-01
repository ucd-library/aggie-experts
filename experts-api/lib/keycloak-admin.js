//Import keycloak-admin-client
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 8);

export default class ExpertsKcAdminClient extends KcAdminClient {
  // create a constructor that just calls the super constructor with the same arguments
  constructor(options) {
    super(options);
  }

  mintExpertId() {
    return nanoid();
  }

  /**
   * List all users
   * @returns {Promise} a promise that will resolve with the list of users
   */
  async list() {
    return this.users.find({enabled: true, briefRepresentation: false, max: 10000});
  }

  /**
   * User count
   * @returns {Promise} a promise that will resolve with the number of users
   */
  async count() {
    return this.users.count();
  }

  /**
   * Find user(s) by attribute
   * @param {string} - attribute:value
    * @returns {Promise} - The user(s) with the attribute
   */
  async findByAttribute(keyVal) {
    try {
      const q_req = await this.users.makeRequest(
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
    const users = await this.findByAttribute(`expertId:${expertId}`);
    //if multiple users are found
    if (users.length > 1) {
      //throw new Error(`Multiple users found with expertId: ${expertId}`);
      exertId = this.mintExpertId();
      await this.users.update({id:user.id},{attributes:{expertId: expertId}});
      return this.verifyExpertId(user,expertId);
    }
    //if no users are found
    if (users.length === 0) {
      throw new Error('No users found with expertId:${expertId}');
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
    return this.users.update(user,update);
  }

    /**
     * Create a new expert
     * @param {object} profile - The usr's profile
     * @returns {Promise} - The user object created
     */
  async createExpert(email,profile) {
    //try to create a new user
    try {
      //create a new user with the username=IDP.email, and link the user to the IDP
      const expertId = this.mintExpertId();
      profile.attributes ||= {};
      profile.attributes.expertId = expertId;
      const userId = await this.users.create(profile);
      let user = await this.verifyExpertId(userId,expertId);
      return user;
    } catch (error) {
      throw error;
    }
  }


  /**
   * Find a user by IDP email
   * @param {Object} idp - The IDP object
   * @param {string} idp.email - The email of the user
   * @returns {Promise} - A promise that resolves with the user object
   */
  async findByEmail(email) {
    //try to find the user in keycloak using the IDP email as the username
    try {
      //get the users from keycloak
      const users = await this.users.findOne({
        email: email,
      });
      return users[0];
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  /*
   * Find a user by IDP email, or create a new user if the user does not exist.
   * @param {string} email - The email of the user
   * @param {Object} username - The IDP userName
   * @returns {Promise} - A promise that resolves with the user expertId
   */
  async getOrCreateExpert(email,username,profile) {
    let user= await this.findByEmail(email);
    if (! user) {
      const new_user = {
        email:email,
        username:email,
        emailVerified: true,
        enabled: true,
        federatedIdentities:[
          { identityProvider: "cas-oidc",
            userId:username,
            userName:username
          }
        ]
      };
      ['firstName','lastName','attributes'].forEach((key) => {
        if (profile[key]) {
          new_user[key] = profile[key];
        }
      });
      user=await this.createExpert(email,new_user);
    }
    return user
  }
}
