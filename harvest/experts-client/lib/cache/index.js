import fs from 'fs-extra';
import fetch from 'node-fetch';
import { logger } from '../logger.js';
import jsonld from 'jsonld';
import path from 'path';
import { performance } from 'node:perf_hooks';


// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exit, versions } from 'process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jp = new jsonld();

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
//    fuseki: {
//      url: 'http://admin:testing123@fuseki:3030',
//      type: 'tdb2'
    //    },
    fuseki:null,
    log: null,
    max: 'empty',
    timeout: 30000,
    base: './cache',
    priority: 10,
    deprioritize: false,
    domain: 'ucdavis.edu',
    refetch: false,
    assembler: null,
    assembler_file: path.join(__dirname,'expert_assembler.jsonld'),
    cdl: null, // Must be passed in
    iam: null,  // Must Be passed in
    kcadmin: null // Must be passed in
  };

  constructor(opt={}) {
    for (let k in Cache.DEF) {
      this[k] = opt[k] || Cache.DEF[k];
    }
    if (this.assembler_file) {
      this.assembler = fs.readFileSync(this.assembler_file, 'utf8');;
    }
//    this.fuseki.log = this.log;
  }

  async createCacheDb() {
    if (! this.cacheDb) {
      if (!this.fuseki) {
        throw new Error('No fuseki url provided');
      }
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

  /**
   * @method list
   * @description Show the current cache, perhaps filtered by expert
   * @param {string or Array} experts - expert or array of experts
   * @returns {Array} - array of cache ordered by date
   **/
  async list(experts,opts) {
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

    while ((!n || n--)) {
      let next = await this.next(experts);
      if (!next.expert) {
        break;
      }
      let expert=new CacheExpert(this,next.expert);

      await expert.fetch();
      await expert.load();
      log.info(`Loaded ${expert.expert}`);
      await expert.transform();
      log.info(`Transformed ${expert.expert}`);
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

export class CacheExpert {
  constructor(cache,expert,opts={}) {
    this.cache=cache;
    this.iam=cache.iam;
    this.cdl=this.cache.cdl;
    this.log=this.cache.log;
    this.kcadmin=this.cache.kcadmin;
    this.refetch=this.cache.refetch;
    this.expert=expert;
    performance.mark(this.expert);
    this.base=path.join(this.cache.base,expert);
  }

  async db() {
    if (! this._db ) {
      // create new fuseki db
      const fuseki=this.cache.fuseki;
      let assembler=null;
      if (this.cache.assembler) {
        assembler = this.cache.assembler.replace(/__USER__/g, this.expert);
      }
      this._db = await fuseki.createDb(this.expert,{replace:true,assembler});
    }
    return this._db;
  }

 async createGraphFromJsonLd(jsonld) {
   //    try {
    let db=await this.db();
      return await db.createGraphFromJsonld(jsonld);
      this.log.info({lib:'cache',measure:this.expert,expert:this.expert},
                    `✔ createGraphFromJsonLd(${this.expert})`);
//    } catch (e) {
//      this.log.error({lib:'cache',error:e,expert:this.expert},
//                     `✘ createGraphFromJsonLd(${this.expert})`);
//    }
  }

  async fetch() {
    const expert=this.expert;

    this.log.info({lib:'cache',measure:expert,expert},`► fetch(${expert})`);

    { // Add in profile
      performance.mark(`iam(${expert})`);
      const pd = path.join(this.base,'ark:','87287','d7c08j');
      if (fs.existsSync(pd)) {
        if (this.refetch) {
          fs.rmdirSync(this.base,{recursive:true});
          this.log.info({lib:'cache',measure:expert,expert},`✖ ${pd}`);
        } else {
          this.log.info({lib:'cache',measure:expert,expert},`✔* ${pd}`);
        }
      } else {
        fs.mkdirSync(pd,{recursive:true});
        this.log.info({lib:'cache',measure:expert,expert},`✔ ${pd}`);
      }
//      try {
         const fn=path.join(pd,'profile.jsonld');
        let profile
        if ( !fs.existsSync(fn) || this.refetch) {
          profile=await this.iam.profile(expert);
        } else {
          profile=JSON.parse(fs.readFileSync(fn));
          this.log.info({lib:'cache',measure:expert,expert},`✔* ${fn}`);
        }

      const kc_fn = path.join(this.base, 'keycloak.json');
      if (this.kcadmin && (!fs.existsSync(kc_fn) || this.refetch)) {
        const p = profile['@graph'][0];
        let kc_user = {};
        if (p) {
          kc_user = {
            firstName: p.oFirstName,
            lastName: p.oLastName,
            attributes: {
              ucdPersonUUID: p.mothraId,
              iamId: p.iamId
            }
          };
        }
        // If an IAM user is not found, we will not be able to create a keycloak user
        if (p) {
          try {
            const kc = await this.kcadmin.getOrCreateExpert(p.email, p.userID, kc_user);
            fs.writeFileSync(kc_fn, JSON.stringify(kc, null, 2));
            this.log.info({ lib: 'cache', measure: expert, expert },
            `✔ ${kc_fn} expertId=${kc.attributes['expertId'][0]}`);
            profile['@graph'][0].expertId = kc.attributes['expertId'][0];
            fs.writeFileSync(fn, JSON.stringify(profile, null, 2));
            this.log.info({ lib: 'cache', measure: expert, expert }, `✔ ${fn}`);
          } catch (e) {
            this.iam=null;
            this.log.error({ lib: 'cache', error: e, expert: expert },
              `✘ ${kc_fn}`);
          }
        } else {
          this.log.error({ lib: 'cache', measure: expert, expert }, `✖ iam(${expert})`);
          this.iam = null;
        }
      }
        this.log.info({lib:'cache',measure:`iam(${expert})`,expert},`✔ iam(${expert})`);
//      } catch (e) {
//        this.log.error({lib:'cache',measure:`iam(${expert})`,
//                        error:e.message,expert},`✘ iam(${expert})`);
//      }
      performance.clearMarks(`iam(${expert})`);
    }
    if (this.iam) {
      // Only fetch cdl if we have an iam
    { // Add in cdl cache
      performance.mark(`cdl(${expert})`);
      const pd=path.join(this.base,'ark:','87287','d7mh2m');
      if (fs.existsSync(pd)) {
        if (this.refetch) {
          fs.rmdirSync(this.base,{recursive:true});
          this.log.info({lib:'cache',measure:expert,expert},`✖ ${pd}`);
        } else {
          this.log.info({lib:'cache',measure:expert,expert},`✔* ${pd}`);
        }
      } else {
        fs.mkdirSync(pd,{recursive:true});
        this.log.info({lib:'cache',measure:expert,expert},`✔ ${pd}`);
      }

      const fn=path.join(pd,'user_000.jsonld');

      if ( !fs.existsSync(fn) || this.refetch) {
        try {
          await this.cdl.getPostUser(expert,{dir:pd,refetch:this.refetch});
          this.log.info({lib:'cache',measure:[expert,`cdl(${expert})`],expert},`✔ getPostUser(${expert})`);
          await this.cdl.getPostUserRelationships(expert,{dir:pd,refetch:this.refetch});
        this.log.info({lib:'cache',measure:[expert,`cdl(${expert}()`],expert},`✔ getPostUserRelationships`);
        this.log.info({lib:'cache',measure:`cdl(${expert})`,expert},`✔ cdl(${expert})`);
         } catch (e) {
           this.log.error({ measure:[`cdl(${expert})`],expert, error: e }, `✘ cdl(${expert})`);
         }
      } else {
        this.log.info({lib:'cache',measure:`cdl(${expert})`,expert},`✔* cdl(${expert})`);
      }
      performance.clearMarks(`cdl(${expert})`);
    }
    }
    this.log.info({lib:'cache',measure:expert,expert},`◄ fetch(${expert})`);
  }

  async load() {
    const expert=this.expert;
    this.log.info({lib:'cache',mark:`load(${expert})`,expert},`► load(${expert})`);

    let db=await this.db();

    const dirs=[ {mark:'base',dir:this.base},
                 {mark:`iam(${expert})`,dir:path.join(this.base,'ark:','87287','d7c08j')},
                 {mark:`cdl(${expert})`,dir:path.join(this.base,'ark:','87287','d7mh2m')}
               ];

    for (const d of dirs) {
      performance.mark(d.mark);
      // If the directory does not exist, skip
      if (!fs.existsSync(d.dir)) {
        this.log.info({lib:'cache',measure:d.mark,expert},`✖ ${d.dir}`);
        performance.clearMarks(d.mark);
        continue;
      }
      const files=fs.readdirSync(d.dir);
      const jsonFiles = files.filter(file => path.extname(file) === '.jsonld');
      for (const file of jsonFiles) {
        const profile=JSON.parse(fs.readFileSync(path.join(d.dir,file)));
        await this.createGraphFromJsonLd(profile);
      }
    }
    this.log.info({lib:'cache',measure:[expert,`load(${expert})`],expert},`◄  load(${expert})`);
    performance.clearMarks(`load(${expert})`);
  }

  /**
   * @method transform
   * @description transform experts into a standard format
   * @param {Array} experts - limit to these experts
   * @returns {Array} - an array of processed cache
   **/
  async transform() {
    const log = this.log;
    const base = this.base;
    const expert = this.expert;

    performance.mark('transform');
    for (const n of ['expert', 'authorship', 'grant']) {
      this.log.info({lib:'cache',mark:n},`splay ${n}`);

      await (async (n) => {
        let bind=fs.readFileSync(path.join(__dirname,`query/${n}/bind.rq`),'utf8');
        const construct_template=fs.readFileSync(path.join(__dirname,`query/${n}/construct.rq`),'utf8');
        let db=await this.db();
        async function constructRecord(bindings) {
          let fn = 1; // write to stdout by default
          let rq = 1; // write to stdout by default
          let construct = construct_template;
          if (bindings['filename']) {
            fn = path.join(base,'fcrepo', 'expert', bindings['filename'].value);
            rq = path.join(base,'rq', bindings['filename'].value);
            delete bindings['filename'];
          }
          performance.mark(fn);

          for (const key in bindings) {
            const value = bindings[key];
            if (value.type === 'literal') {
              construct = construct.replace(new RegExp(`\\?${key}`, 'g'), `"${value.value}"`);
            } else if (value.type === 'uri')
            {
              construct = construct.replace(new RegExp('\\?' + key, 'g'), `<${value.value}>`);
            }
          }
          fs.ensureFileSync(`${rq}.rq`);
          fs.writeFileSync(`${rq}.rq`, construct);
          let doc=await db.construct(construct);
          doc = await jp.expand(doc, { omitGraph: false, safe: false, ordered: true });
//          const nquads = await jsonld.canonize(doc, {format: 'application/n-quads'});
          //          const num = (nquads.match(/\r|\r\n|\n/g) || '').length;
          const num = 0
          fs.ensureFileSync(fn);
          fs.writeFileSync(fn, JSON.stringify(doc, null, 2));
//          fs.writeFileSync(`${fn}.nq`, nquads);
          log.info({lib:'cache',measure:[fn],quads:num},'record');
          performance.clearMarks(fn);
        }

        let result = await db.query(bind);
        for (const bindings of result.results.bindings) {
          // log.info('constructRecord',bindings);
          await constructRecord(bindings);
        }
      })(n);
      this.log.info({lib:'cache',measure:[n],expert:expert},`splayed ${n}`);
      performance.clearMarks(n);
    };
    this.log.info({lib:'cache',measure:['transform',expert],expert:expert},`transform`);
    performance.clearMarks('transform');
  }

}


export default Cache;
