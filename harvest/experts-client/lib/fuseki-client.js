import fetch from 'node-fetch';
import { logger } from './logger.js';

export class FusekiClient {
  static DEF= {
    url: 'http://admin:testing123@localhost:3030',
    replace: false,
    type: 'tdb2',
    log: logger
  };

  constructor(opt) {
    opt = opt || {};
    for (let k in FusekiClient.DEF) {
      this[k] = opt[k] || FusekiClient.DEF[k];
    }

    if (opt.url) {
      let url = new URL(opt.url);
      this.auth=opt.auth || url.username+':'+url.password;
      this.url = url.origin;
    }
    this.reauth();
  }

  /**
   * @method auth
   * @description Authenticate to Fuseki server.  Sets authBasic property.
   **/
  reauth() {
    if (!this.auth) {
      throw new Error('No Fuseki auth specified');
    }
    // You can still specify a db name if you want, otherwise we'll generate a
    // random one
    if (this.auth.match(':')) {
      this.authBasic=Buffer.from(this.auth).toString('base64');
    } else {
      this.authBasic=this.auth;
    }
  }

  async existsDb(opt) {
    if(typeof opt === 'string') {
      opt={db:opt};
    }
    opt.type ||= this.type;
    opt.replace ||= this.replace;

    let exists = false;

    if (!this.url) {
      throw new Error('No Fuseki url specified');
    }
    if (!opt.type) {
      throw new Error('No Fuseki type specified');
    }
    if (!opt.db) {
      throw new Error('No Fuseki db specified');
    }

    const res = await fetch(
      `${this.url}/\$/datasets/${opt.db}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.authBasic}`
        }
      });
    if (res.ok) {
      return true;
    } else if (res.status === 404) {
      return false;
    } else {
      throw new Error(`Error checking for db ${opt.db}: ${res.status} ${res.statusText}`);
    }
  }


  async createDb(opt,files) {
    if(typeof opt === 'string') {
      opt={db:opt};
    }
    opt.type ||= this.type;
    opt.replace ||= this.replace;

    let exists = false;

    if (!this.url) {
      throw new Error('No Fuseki url specified');
    }
    if (!opt.type) {
      throw new Error('No Fuseki type specified');
    }
    if (!opt.db) {
      throw new Error('No Fuseki db specified');
    }

    const res = await fetch(
      `${this.url}/\$/datasets/${opt.db}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.authBasic}`
        }
      });
    if (res.ok) {
      if (opt.replace) {
        this.log.info({db:opt.db,op:'delete'},`Deleting existing fuseki dataset ${opt.db}`);
        await this.dropDb(opt);
      } else {
        this.log.info({db:opt.db,op:'reuse'},`Using existing fuseki dataset ${opt.db}`);
        exists = true;
      }
    }

    if (! exists) {
      const res = await fetch(
        `${this.url}/\$/datasets`,
        {
          method: 'POST',
          body: new URLSearchParams({ 'dbName': opt.db, 'dbType': opt.type }),
          headers: {
            'Authorization': `Basic ${this.authBasic}`
          }
        });
      if (!res.ok) {
        throw new Error(`Create db ${opt.db} failed . Code: ${res.status}`);
      }
    }

    const db=new FusekiClientDB(
      {url:this.url,
       auth:this.auth,
       authBasic:this.authBasic,
       ...opt});

    if (files) {
      this.files = await db.addToDb(files);
    }
    return db;
  }

  async dropDb(opt) {
    if(typeof opt === 'string') {
      opt={db:opt};
    }

    if (!opt.db) {
      throw new Error('No Fuseki db specified');
    }

    if (this.url && opt.db ) {
      const res = await fetch(`${this.url}/\$/datasets/${opt.db}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${this.authBasic}`
          }
        })
      return res.status;
    }
  }
}

export class FusekiClientDB {
  constructor(opts) {
    this.url = opts.url;
    this.auth = opts.auth;
    this.authBasic = opts.authBasic;
    this.db = opts.db;
    this.type = opts.type;
    this.replace = opts.replace;
  }

  source() {
    return `${this.url}/${this.db}/sparql`;
  }

  /**
   * upload file to fuseki.  We unambiguousely specify the fuseki endpoint.
   And right now, you can't specify a default graph name for the jsonld file.
  */
  async addToDb(files) {
    files instanceof Array ? files : [files]
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const jsonld = fs.readFileSync(file);
      // Be good to have verbose output better NDJSON for debugging
      const res = await fetch(`${this.url}/${opt.db}/data`, {
        method: 'POST',
        body: jsonld,
        headers: {
          'Authorization': `Basic ${this.authBasic}`,
          'Content-Type': 'application/ld+json'
        }
      })
      const json = await res.json();
      const log = {
        file: file,
        status: res.status,
        response: json
      };
      results.push(log);
    }
    return results;
  }

  async update(query) {
    const url = `${this.url}/${this.db}/update`;

    // Set request options
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-update',
        'Authorization': `Basic ${this.authBasic}`
      },
      body: query,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Failed to execute update. Status code: ${response.status}`);
    }

    return await response.text();
  }

  async query(query) {
    const url = `${this.url}/${this.db}/query`;

    // Set request options
    const options = {
      method: 'POST',
      headers: {
         'Content-Type': 'application/sparql-query',
        'Authorization': `Basic ${this.authBasic}`,
        'Accept': 'application/sparql-results+json'
      },
      body: query,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Failed to execute query. Status code: ${response.status}`);
    }

    return await response.json();
  }

  async construct(query) {
    const url = `${this.url}/${this.db}/query`;

    // Set request options
    const options = {
      method: 'POST',
      headers: {
         'Content-Type': 'application/sparql-query',
        'Authorization': `Basic ${this.authBasic}`,
        'Accept': 'application/ld+json'
      },
      body: query,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Failed to execute construct. Status code: ${response.status}`);
    }

    return await response.json();
  }

  async createGraphFromJsonLdFile(jsonld) {
    // Construct URL for uploading the data to the graph
    // Don't include a graphname to use what's in the jsonld file
    const url = `${this.url}/${this.db}/data`;

    // Set request options
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ld+json',
        'Authorization': `Basic ${this.authBasic}`
      },
      body: jsonld,
    };

    // Send the request to upload the data to the graph
    const response = await fetch(url, options);

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`Failed to create graph. Status code: ${response.status}` + response.statusText);
    }

    return await response.text();
  }
}
export default FusekiClient;
