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
   * Find user(s) by expertId
   * @param {string} expertId - The expertId to search for
   * @returns {Promise} - The user(s) with the expertId
   */
  async findByExpertId(expertId) {
    //try to get the user(s) with the expertId
    try {
      //get the user(s) with the expertId
      const q_req = await this.users.makeRequest(
        {
          method: 'GET',
          payloadKey: "q"
        }
      );
      const users = await q_req(
        {
            q: `expertId:${expertId}`
        }
      );

      //return the user(s) with the expertId
      return users;
    } catch (error) {
      this.log.error(error);
      throw error;
    }
  }

  /**
   * Verify the expertId of a user
   * @param {object} user - The user object to verify
   * @returns {Promise} - The user object with a verified expertId
   */
  async verifyExpertId(user,expertId) {
    const users = await this.findByExpertId(expertId);
    //if multiple users are found
    if (users.length > 1) {
      //throw new Error(`Multiple users found with expertId: ${expertId}`);
      exertId = this.mintExpertId();
      user.attributes={expertId: expertId};
      user=await this.users.update(user);
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

    /**
     * Create a user by IDP
     * @param {object} IDP - The IDP object to create the user by
     * @returns {Promise} - The user object created
     */
  async createByIDP(email,idp) {
    //try to create a new user
    try {
      //create a new user with the username=IDP.email, and link the user to the IDP
      const expertId = this.mintExpertId();
      const userId = await this.users.create({
        username: email,
        email: email,
        emailVerified: true,
        enabled: true,
        attributes: {
          expertId: expertId,
        },
        federatedIdentities:[
          {identityProvider: "cas-oidc",
           userId:idp.userId,
           userName:idp.userName
           }
        ]
      });
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
  async getOrCreateExpert(email,username) {
    let user= await this.findByEmail(email);
    if (! user) {
      const idp = {
        userName: username,
        userId: username
      };
      this.log.info(`new User: email: ${email} and idp username: ${username}`);
      user=await this.createByIDP(email,idp);
    }
    return user
  }
}
