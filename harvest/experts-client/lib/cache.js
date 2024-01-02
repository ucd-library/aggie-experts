import fetch from 'node-fetch';
import { logger } from './logger.js';
import { FusekiClient } from './fuseki-client.js';
import jsonld from 'jsonld';
const expand=jsonld.expand;

export class Cache {

  static context={
    "@context": {
      "@vocab": "http://schema.library.ucdavis.edu/schema/cache#",
      "schema": "http://schema.org/",
      "xsd": "http://www.w3.org/2001/XMLSchema#",
      "Cached": {"@type": "@id"},
      "Empty": {"@type": "@id"},
      "Error": {"@type": "@id"},
      "FetchError": {"@type": "@id"},
      "ParseError": {"@type": "@id"},
      "Pending": {"@type": "@id"},
      "SplayError": {"@type": "@id"},
      "WriteError": {"@type": "@id"},
      "base": { "@type": "@id" },
      "cache": {"@type": "@id"},
      "error": { "@type": "@id" },
      "iat": {"@type": "xsd:dateTimeStamp" },
      "priority": {"@type": "xsd:integer" },
      "queue": {"@type": "@id"},
      "url": {"@type": "@id" }
    }
  };


  static DEF = {
    fuseki: {
      url: 'http://admin:testing123@fuseki:3030',
      type: 'tdb2'
    },
    max: 'empty',
    timeout: 30000,
    base: './cache',
    priority: 10,
    deprioritize: false,
    domain: 'ucdavis.edu'
  };

  constructor(opt) {
    opt = opt || {};
    for (let k in Cache.DEF) {
      this[k] = opt[k] || Cache.DEF[k];
    }
    this.fuseki = new FusekiClient(opt.fuseki);
    this.cache = fuseki.Db('cache');
  }

  invalidate(users) {
  }

  list(users) {}
  process(users) {}

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
        throw new Error('enqueue options requires an object');
      }
    }

    experts=this.normalize_experts(experts);
    if (!Array.isArray(experts)) {
      experts = [experts];
    }

    for (let expert of experts) {
      // add @domain to expert if not present
      if (!expert.match(/@/)) {
        expert = `${expert}@${this.domain}`;
      }
      if (!expert.match(/^mailto:/)) {
        expert = `mailto:${expert}`;
      }
      let entry={
        "@id": expert,
        "priority": priority,
        "iat": new Date().toISOString(),
      };

      let current = null;
      try {
        current = this.entry(expert);
      }

      const sparql = `
        PREFIX : <http://schema.library.ucdavis.edu/schema/cache#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        INSERT DATA {
           ${expert} :queue ${expert}#queue;
            ${expert}#queue :priority "${priority}"^^xsd:integer .
            ${expert}#queue :iat "${new Date().toISOString()}"^^xsd:dateTime .
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

  normalize_experts(experts=[]) {
    if (!Array.isArray(experts)) {
      experts = [experts];
    }
    experts = experts.map(expert => {
      if (!expert.match(/@/)) {
        expert = `${expert}@${this.domain}`;
      }
      if (!expert.match(/^mailto:/)) {
        expert = `mailto:${expert}`;
      }
      return expert;
    });
    return experts
  }

  async queue(experts) {
    let values='';
    if(experts) {
      experts=this.normalize_experts(experts);
      values=`VALUES ?expert { ${experts.map(expert => `<${expert}>`).join(' ')} }`;
    }

    let query=`
PREFIX : <http://schema.library.ucdavis.edu/schema/cache#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
construct {
	?expert_queue :iat ?iat;
	:priority ?priority;
	.
} WHERE {
	select ?expert ?expert_queue ?iat ?priority where {
    ${values}
    ?expert :queue ?expert_queue.
    ?expert_queue :priority ?priority;
                  :iat ?iat .
    } ORDER BY ?priority ?iat
}
      `;

    let queue=await this.fuseki.query(query);

    let framed = await jsonld.compact(queue,Cache.context,{omitGraph:false});

    // Order authors by rank
    if (! Array.isArray(framed["@graph"])) {
      framed["@graph"]= [ framed["@graph"] ];
    }
    framed["@graph"].sort((a,b) => a.iat - b.iat);
    framed["@context"] = "http://schema.library.ucdavis.edu/schema/cache#";
    return framed;
  }

  dequeue(expert) {
  }

  list() {
  }

  next() {
  }

}
export default Cache;
