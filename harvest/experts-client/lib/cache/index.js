import fs from 'fs-extra';
import fetch from 'node-fetch';
import { logger } from '../logger.js';
import { FusekiClient } from '../fuseki-client.js';
import jsonld from 'jsonld';
import path from 'path';
import { performance } from 'node:perf_hooks';


// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exit, versions } from 'process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    iam: null,  // Must Be passed in
    kcadmin: null // Must be passed in
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
   * @method transform
   * @description transform experts into a standard format
   * @param {Array} experts - limit to these experts
   * @returns {Array} - an array of processed cache
   **/
  async transform(expert,db) {
//    for (const n of ['expert', 'authorship', 'grant_role']) {
    for (const n of ['expert']) {
//      this.log.info({mark:n,user},`splay ${n}`);

      await (async (n) => {
        let bind=fs.readFileSync(path.join(__dirname,`query/${n}/bind.rq`),'utf8');
        let construct=fs.readFileSync(path.join(__dirname,`query/${n}/construct.rq`),'utf8');
        async function constructRecord(bindings) {
          let fn = 1; // write to stdout by default
          if (bindings.get('filename') && bindings.get('filename').value) {
            if (this.output) {
              fn = path.join(opt.output, bindings.get('filename').value);
            } else {
              fn = bindings.get('filename').value
            }
            bindings = bindings.delete('filename');
          }
          performance.mark(fn);

          for (const [key, value] of bindings) {
            if (value.termType === 'Literal') {
              construct = construct.replace(new RegExp(`\\?${key.value}`, 'g'), `"${value.value}"`);
            } else if (value.termType === 'NamedNode') {
              construct = construct.replace(new RegExp('\\?' + key.value, 'g'), `<${value.value}>`);
            }
          }
          let doc=db.construct(construct);
//          doc = await jp.expand(doc, { omitGraph: false, safe: false, ordered: true });
          fs.ensureFileSync(fn);
          fs.writeFileSync(fn, JSON.stringify(doc, null, 2));
          this.logger.info({measure:[fn],quads:quads.length,user:opt.user},'record');
          performance.clearMarks(fn);
        }

        let bindings = await db.query(bind);
        console.log(bindings);

//        const queue = new readablePromiseQueue
//        (
//          bindingStream, constructRecord,
//          { name: 'splay', max_promises: 5, logger: this.log }
//        );
//        return queue.execute({ via: 'start' });
      })(n);
//      this.log.info({measure:[n],user},`splayed ${n}`);
//      performance.clearMarks(n);
    };
//    this.log.info({measure:['splay',user],user},`splayed`);
//    performance.clearMarks('splay');
  }

  /**
   * @method process
   * @description process experts from the queue
   * @param {Array} experts - limit to these experts
   * @returns {Array} - an array of processed cache
   **/
  async process(experts,opt={}) {
    let max=opt.max || this.max;

    let n=null;
    if (max.match(/^[0-9]+$/)) {
      n=parseInt(max);
    }
    experts=this.normalize_experts(experts);

    let expert;
    let db;

    while ((!n || n--)) {
      let next = await this.next(experts);
      if (!next.expert) {
        break;
      }
      let expert = next.expert;
      this.log.info({mark:expert,expert},`►process(${expert})`);
      const d=path.join(this.base,expert);

      // create new fuseki db
      db = await this.fuseki.createDb(expert,{replace:true});
      this.log.info({measure:expert,expert},`✔ fuseki(${expert})`);

      { // Add in profile
        performance.mark(`iam(${expert})`);
        const pd = path.join(d,'ark:','87287','d7c08j');
        if (fs.existsSync(pd)) {
          fs.rmdirSync(d,{recursive:true});
          this.log.info({measure:expert,expert},`✖ ${pd}`);
        }
        fs.mkdirSync(pd,{recursive:true});
        this.log.info({measure:expert,expert},`✔ ${pd}`);
        try {
          const profile=await this.iam.profile(expert);

          if (this.kcadmin) { // Add keycloak
            const p=profile['@graph'][0];
            const kc_user = {
              firstName : p.oFirstName,
              lastName : p.oLastName,
              attributes : {
                ucdPersonUUID:p.mothraId,
                iamId:p.iamId
              }
            };
            const kc=await this.kcadmin.getOrCreateExpert(p.email,p.userID,kc_user);
            const fn=path.join(d,'keycloak.json');
            fs.writeFileSync(fn,JSON.stringify(kc,null,2));
            profile['@graph'][0].expertId=kc.attributes['expertId'][0];
            this.log.info({measure:expert,expert},
                          `✔ kc(${expert}) expertId=${kc.attributes['expertId'][0]}`);
          }
          fs.writeFileSync(path.join(pd,'profile.jsonld'),
                           JSON.stringify(profile,null,2));

          await db.createGraphFromJsonLdFile(profile);
          this.log.info({measure:`iam(${expert})`,expert},'✔ iam(${expert})');
        } catch (e) {
          this.log.error({measure:`iam(${expert})`,error:e.message,expert},`✖ iam(${expert})`);
        }
        performance.clearMarks(`iam(${expert})`);
      }
      { // Add in cdl cache
        performance.mark(`cdl(${expert})`);
        try {
          const cdl_path=path.join(d,'ark:','87287','d7nh2m');
          await this.cdl.getPostUser(db,expert,{dir:cdl_path});
          this.log.info({measure:[expert,`cdl(${expert})`],expert},`✔ getPostUser(${expert})`);
        await this.cdl.getPostUserRelationships(db,expert,{dir:cdl_path});
        this.log.info({measure:[expert,`cdl(${expert}()`],expert},`✔ getPostUserRelationships`);
        }
        catch (e) {
          this.log.error({ expert, error: e }, `error ${expert}`);
        }
        this.log.info({measure:`cdl(${expert})`,expert},'✔ cdl(${expert})');
        performance.clearMarks(`cdl(${expert})`);
      }

      this.log.info({measure:expert,expert},`✔ fetched($expert)`);
      this.transform(expert,db);
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
