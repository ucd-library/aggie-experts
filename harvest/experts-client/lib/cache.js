import fs from 'fs-extra';
import fetch from 'node-fetch';
import { logger } from './logger.js';
import { FusekiClient } from './fuseki-client.js';
import jsonld from 'jsonld';
import path from 'path';
import { performance } from 'node:perf_hooks';

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
      "expert": { "@type": "@id" },
      "iat": {"@type": "xsd:decimal" },
      "priority": {"@type": "xsd:integer" },
      "queue": {"@type": "@id"},
      "Queue": {"@id":"@graph"},
      "url": {"@type": "@id" }
    }
  };

  static DEF = {
    fuseki: {
      url: 'http://admin:testing123@fuseki:3030',
      type: 'tdb2'
    },
    log: logger,
    max: 'empty',
    timeout: 30000,
    base: './cache',
    priority: 10,
    deprioritize: false,
    domain: 'ucdavis.edu',
    cdl: null, // Must be passed in
    iam: null  // Must Be passed in
  };

  constructor(opt) {
    opt = opt || {};
    for (let k in Cache.DEF) {
      this[k] = opt[k] || Cache.DEF[k];
    }
    this.fuseki.log = this.log;
  }

  async createCacheDb() {
    if (! this.cacheDb) {
      if (!this.fuseki.url) {
        throw new Error('No fuseki url provided');
      }
      this.fuseki = new FusekiClient(this.fuseki);
      this.cacheDb = await this.fuseki.createDb('cache');
    }
    return this.cacheDb;
  }

  /**
   * @method normalize_experts
   * @description normalize experts to standard URI format
   * @param {Array} experts - an expert or array of experts
   * @returns {Array} - an array of normalized experts
   **/
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

  invalidate(users) {
  }

  list(users) {}

  /**
   * @method process
   * @description process experts from the queue
   * @param {Array} experts - limit to these experts
   * @returns {Array} - an array of processed cache
   **/
  async process(experts,opt) {
    opt ||= {};

    let max=opt.max || this.max;

    let n=null;
    if (max.match(/^[0-9]+$/)) {
      n=parseInt(max);
    }
    experts=this.normalize_experts(experts);

    let expert;

    while ((!n || n--)) {
      let next = await this.next(experts);
      if (!next.expert) {
        break;
      }
      let expert = next.expert;
      this.log.info({mark:expert,expert},`► process(${expert})`);
      const d=path.join(this.base,expert);
      { // Add in profile
        performance.mark(`iam(${expert})`);
        const pd = path.join(d,'ark:','87287','d7c08j');
        if (!fs.existsSync(pd)) {
          fs.mkdirSync(pd,{recursive:true});
        }
        // iam profile
        try {
          const profile=await this.iam.profile(expert);
          fs.writeFileSync(path.join(pd,'profile.jsonld'),
                           JSON.stringify(profile,null,2));
          this.log.info({measure:`iam(${expert})`,expert},'► ◄ iam(${expert})');
        } catch (e) {
          this.log.error({measure:`iam(${expert})`,error:e.message,expert},`'►E◄ iam(${expert})`);
        }
      }
      { // Add in cdl cache
        try {
          let db = await this.fuseki.createDb(expert);
          await this.cdl.getPostUser(db,expert)
          this.log.info({measure:[expert],expert},`getPostUser`);
          await this.cdl.getPostUserRelationships(db,expert,'detail=full');
          this.log.info({measure:[expert],expert},`getPostUserRelationships`);
        }
        catch (e) {
          this.log.error({ expert, error: e }, `error ${expert}`);
        }
      }

      this.log.info({measure:expert,expert},`◄ process($expert)`);
      performance.clearMarks(expert);
    }
  }

  /**
   * @method enqueue
   * @description Add an expert to the queue.
   * @param {string or Array} expert - expert object
   * @param {object} opts - options for the expert
   * @param {number} opts.priority - priority for the expert
   * @param {boolean} opts.deprioritize - deprioritize the expert
    **/
  async enqueue(experts,opts) {
    await this.createCacheDb();
    let iat = Date.now()/1000;
    let priority =this.priority;
    let deprioritize = this.deprioritize;

    iat ||= opts?.iat;
    priority ||= opts?.priority;
    deprioritize ||= opts?.deprioritize;

    if (priority==='all') {
      priority = 10;
    }

    experts=this.normalize_experts(experts);

    let filter='';
    if (! deprioritize) {
      filter=`filter(! bound(?cur_priority) ||
                     ?priority < ?cur_priority ||
                     (?priority = ?cur_priority && ?iat < ?cur_iat ))`;
    }

      const update = `
PREFIX : <http://schema.library.ucdavis.edu/schema/cache#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
DELETE {
 ?expert_queue :iat ?cur_iat;
    :priority ?cur_priority;
    .
} INSERT {
  ?expert :queue ?expert_queue.

  ?expert_queue :iat ?iat;
    			:priority ?priority;
    .
} WHERE {
 VALUES ?expert { ${experts.map(expert => `<${expert}>`).join(' ')} }
  bind(${priority} as ?priority)
  bind(${iat} as ?iat)
  bind(uri(concat(str(?expert),'#queue')) as ?expert_queue)

  OPTIONAL {
	  ?expert_queue :priority ?cur_priority;
    	            :iat ?cur_iat;
        	        .
  }
  ${filter}
}
      `;

    await this.cacheDb.update(update);
    return await this.queue(experts);
  }

  /**
   * @method queue
   * @description Get the the current queue, perhaps filtered by expert
   * @param {string or Array} experts - expert or array of experts
   * @returns {Array} - array of queue entries ordered by priority
   **/
  async queue(experts,opts) {
    let priority =this.priority;

    await this.createCacheDb();
    let values='';
    if(experts && experts.length>0) {
      experts=this.normalize_experts(experts);
      values=`VALUES ?expert { ${experts.map(expert => `<${expert}>`).join(' ')} }`;
    }
    let priority_filter='';
    if (priority != 'all') {
      priority_filter=`?expert_queue :priority ?priority.
                      filter(?priority = ${priority})`;
    }
    let limit='';
    if (opts?.limit) {
      limit=`limit ${opts.limit}`;
    }

    let query=`
PREFIX : <http://schema.library.ucdavis.edu/schema/cache#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
construct {
?expert_queue :iat ?iat;
	:priority ?priority;
  :expert ?expert ;
	.
} WHERE {
	select ?expert ?expert_queue ?iat ?priority where {
    ${values}
    ?expert :queue ?expert_queue.
    ?expert_queue :priority ?priority;
                  :iat ?iat .
    ${priority_filter}
    } ORDER BY ?priority ?iat ${limit}
}
      `;

    let queue=await this.cacheDb.construct(query);
    let context=Cache.context;
    context.iat={};
    context.priority={};
    let framed = await jsonld.frame(queue,Cache.context,{omitGraph:false});

    // Order authors by rank
    if (! Array.isArray(framed["Queue"])) {
      framed["Queue"]= [ framed["Queue"] ];
    }
    framed["Queue"].sort((a,b) => a.priority-b.priority || a.iat - b.iat);
    framed["@context"] = "http://schema.library.ucdavis.edu/schema/cache#";
    return framed;
  }

  /**
   * @method dequeue
   * @description Remove an expert to the queue.
   * @param {string or Array} expert or array of experts
   * @returns {Array} - array of queue entries removed
   **/
  async dequeue(experts,opts) {
    await this.createCacheDb();
    let priority =this.priority;

    priority ||= opts?.priority;

    experts=this.normalize_experts(experts);

    const queue=await this.queue(experts);

    let values='';
    if(experts && experts.length>0) {
      experts=this.normalize_experts(experts);
      values=`VALUES ?expert { ${experts.map(expert => `<${expert}>`).join(' ')} }`;
    }

    let priority_filter='';
    if (priority != 'all') {
      priority_filter=`?expert_queue :priority ?priority.
                      filter(?priority = ${priority})`;
    }

      const update = `
PREFIX : <http://schema.library.ucdavis.edu/schema/cache#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
DELETE {
  ?expert :queue ?expert_queue.
  ?expert_queue ?p ?o.

} WHERE {
  ${values}
  bind(uri(concat(str(?expert),'#queue')) as ?expert_queue)
  ?expert_queue ?p ?o.
  ${priority_filter}
}
      `;

    await this.cacheDb.update(update);
    return queue;
  }

  /**
   * @method next
   * @description Get the next queue entry, by priority removing it from queue
   * @returns {object} - queue entries ordered by priority
   **/
  async next(experts,opts) {
    let next= await this.queue(experts,{limit:1});
    if (next.Queue && next.Queue.length>0) {
      await this.dequeue(next.Queue[0].expert);
      return next.Queue[0];
    }
    return {};
  }
}
export default Cache;
