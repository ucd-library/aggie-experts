//Import keycloak-admin-client
import KeycloakAdminClient from 'keycloak-admin-client';
//import nanoid
import { nanoid } from 'nanoid';
//import logger from logger.js
import logger from './logger.js';

//create a new class, ExpertsKeycloakAdminClient that extends KeycloakAdminClient
export class ExpertsKeycloakAdminClient extends KeycloakAdminClient {
  //create a constructor that takes in the keycloak admin url, the keycloak admin realm, the keycloak admin client id, the keycloak admin client secret, and the keycloak admin grant type
  constructor(keycloakAdminUrl, keycloakAdminRealm, keycloakAdminClientId, keycloakAdminClientSecret, keycloakAdminGrantType) {
    //call the super class constructor
    super(keycloakAdminUrl, keycloakAdminRealm, keycloakAdminClientId, keycloakAdminClientSecret, keycloakAdminGrantType);
  }

  // create a method to search for a user by email, this method takes in the email of the user to search for throw and error if the user is not found, and add javascript doc comments to the method
  /**
   * Search for a user by email
   * @param {string} email - The email of the user to search for
   * @returns {Promise} - A promise that resolves with the user object if the user is found
   */
  async searchUserByEmail(email) {
    //create a try block
    try {
      //call the searchUsers method from the super class and pass in the email as the search parameter
      const users = await this.searchUsers({ email: email });
      //if the users array is empty
      if (users.length === 0) {
        //throw an error
        throw new Error(`User with email ${email} not found`);
      }
      //return the first user in the users array
      return users[0];
    } catch (error) {
      //log the error
      logger.error(error);
      //throw the error
      throw error;
    }
  }

  // create a method to create a user, this method takes in the user object to create, and add javascript doc comments to the method
  /**
   * Create a user
   * @param {object} user - The user object to create
   * @returns {Promise} - A promise that resolves with the created user object
   */
  async createUser(user) {
    //create a try block
    try {
      //call the createUser method from the super class and pass in the user object
      const createdUser = await this.createUser(user);
      //return the created user
      return createdUser;
    } catch (error) {
      //log the error
      logger.error(error);
      //throw the error
      throw error;
    }
