import fetch from 'node-fetch';
import { logger } from './logger.js';
import { FusekiClient } from './fuseki-client.js';

export class Cache {

  static DEF = {
    fuseki: {
      url: 'http://fuseki:3030',
      type: 'tdb2'
    },
    max: 'empty',
    timeout: 30000,
    base: './cache'
  };

  constructor(opt) {
    opt = opt || {};
    for (let k in Cache.DEF) {
      opt[k] = opt[k] || Cache.DEF[k];
    }
    this.reauth();
  }

  /**
   * @method auth
   * @description Authenticate to Fuseki server.  Sets authBasic property.
   **/


  .option('--invalidate','remove expert(s) from the cache')
  .option('--list', 'list cache information')
  .option('--priority <1-20>','priority for enqueue', 10)
  .option('--queue', 'list queue information')
  .option('--resolve','resolve expert(s) from the cache')

}

export class CacheQueue {

  static DEF = {
    priority: 10,
    deprioritize: false,
    domain: 'ucdavis.edu'
  };

  /**
   * @method constructor
   * @description Create a new CacheQueue object.
   * @param {object} opts - options for the CacheQueue object
   * @param {number} opts.priority - priority for the queue
   * @param {boolean} opts.deprioritize - deprioritize the queue
   * @param {string} opts.domain - domain for the queue
   **/
  constructor(opts) {
    opts = opts || {};
    for (let k in CacheQueue.DEF) {
      opts[k] = opts[k] || CacheQueue.DEF[k];
    }
  }

  /**
   * @method enqueue
   * @description Add an expert to the queue.
   * @param {object} expert - expert object
   * @param {object} opts - options for the expert
   * @param {number} opts.priority - priority for the expert
   * @param {boolean} opts.deprioritize - deprioritize the expert
    **/
  enqueue(experts,opts) {
    let priority, deprioritize;

    if (defined(opts)) {
      if (typeof opts === 'object') {
        priority = opts.priority || this.priority;
        deprioritize = opts.deprioritize || this.deprioritize;
      } else {
        throw new Error('enqueue requires an expert object');
      }
    }

    if (!Array.isArray(experts)) {
      experts = [experts];
    }

    for (let expert of experts) {
      // add @domain to expert if not present
      if (!expert.match(/@/)) {
        expert = `${expert}@${this.domain}`;
      }
      let entry={
        "@id": expert,
        "priority": priority,
        "added": new Date().toISOString(),
      };

      let current = null;
      try {
        current = this.entry(expert);
      }

      const sparql = `
        PREFIX cache: <http://experts.ucdavis.edu/cache/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        INSERT DATA {
          GRAPH cache: {
            ${expert} cache:priority "${priority}"^^xsd:integer .
            ${expert} cache:added "${new Date().toISOString()}"^^xsd:dateTime .
          }
        }
      `;

      if (this.experts[expert.id]) {
        // update priority
        this.experts[expert.id].priority = priority;
      } else {
        // add expert to queue
        this.experts[expert.id] = {
          expert: expert,
          priority: priority,
          deprioritize: deprioritize
        };
      }
    }

  }

  dequeue(expert) {
  }

  list() {
  }

  next() {
  }

}
export default Cache;
