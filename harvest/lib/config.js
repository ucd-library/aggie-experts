import path from 'path';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);

const env = process.env;

const esHostname = process.env.ES_HOST || 'elasticsearch';
const esPort = process.env.ES_PORT || 9200;

const config = {
  reporting : {
    enabled : env.ETL_REPORTING_ENABLED || false,
    jobId : env.ANDUIN_JOB_ID,
  },

  cache : {
    rootDir : env.EXPERTS_CACHE_ROOT_DIR || path.join(process.cwd(), 'ae-harvest-cache'),
    cdlDir : env.EXPERTS_CDL_CACHE_DIR || 'cdl',
    iamDir : env.EXPERTS_IAM_CACHE_DIR || 'iam',
    aeStdFormatDir : env.EXPERTS_AE_STD_FORMAT_CACHE_DIR || 'ae-std',
    aeWebappDir : env.EXPERTS_AE_WEBAPP_CACHE_DIR || 'ae-webapp',
    keycloakDir : env.EXPERTS_KEYCLOAK_CACHE_DIR || 'keycloak',
    cdlUserFilename : 'user_000.json',
    iamUserFilename : 'profile.json',
  },

  elasticsearch : {
    host : esHostname,
    port : esPort,
    username : process.env.ES_USERNAME || 'elastic',
    password : process.env.ES_PASSWORD || 'elastic',
    get connStr () {
      return `http://${this.host}:${this.port}`
    },
    indexes : {
      experts : env.ES_INDEX_EXPERTS || 'experts',
      hash : env.ES_INDEX_CACHE || 'cache',
    }
  },

  keycloak : {
    secretPath : 'projects/325574696734/secrets/service-account-harvester',
  },

  cdl : {
    env : env.EXPERTS_CDL_ENV || 'prod',
    timeout : env.EXPERTS_CDL_TIMEOUT || 30000,

    context : {
      "@context": {
        "@base": "ark:/87287/d7mh2m/",
        "@vocab": "ark:/87287/d7mh2m/schema#",
        "oap": "ark:/87287/d7mh2m/schema#",
        "api": "ark:/87287/d7mh2m/schema#",
        "id": { "@type": "@id", "@id": "@id" },
        "field-name": "api:field-name",
        "field-number": "api:field-number",
        "$t": "api:field-value",
        "api:person": { "@container": "@list" },
        "api:first-names-X": { "@container": "@list" },
        "api:web-address": { "@container": "@list" }
      },
      "@id":'ark:/87287/d7mh2m/'
    },

    qa : {
      url : 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
      authname : 'qa-oapolicy',
      secretpath : 'projects/325574696734/secrets/cdl-elements-json',
      timeout : 30000
    },

    prod: {
      url : 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
      authname : 'oapolicy',
      secretpath : 'projects/325574696734/secrets/cdl-elements-json',
      group_by_name : {
        'dev': 1591,
        'sandbox': 1587,
        'experts': 1576
      },
      timeout : 30000
    }
  },

  iam : {
    env : env.EXPERTS_IAM_ENV || 'prod',
    timeout : env.EXPERTS_IAM_TIMEOUT || 30000,

    context : {
      "@context": {
        "@version":1.1,
        "@base":"ark:/87287/d7c08j/user/",
        "@vocab":"ark:/87287/d7c08j/schema#",
        "iamId":{
          "@type":"@id",
          "@id":"@id",
          "@context": {
            "@base":"ark:/87287/d7c08j/user/"
          }
        },
        "bouOrgoid": {
          "@type":"@id",
          "@context": {
            "@base":"ark:/87287/d7c08j/organization/"
          }
        },
        "titleCode": {
          "@type":"@id",
          "@context": {
            "@base":"ark:/87287/d7c08j/position/"
          }
        }
      }
    },

    dev: {
      url: 'https://iet-ws-stage.ucdavis.edu/api/iam',
      authname: 'iet-ws-stage',
      secretpath: 'projects/325574696734/secrets/ucdid_auth',
      timeout: 30000
    },
    prod: {
      url: 'https://iet-ws.ucdavis.edu/api/iam',
      authname: 'iet-ws',
      secretpath: 'projects/325574696734/secrets/ucdid_auth',
      timeout: 30000
    }
  },

  vocab : {
    ucopFile : path.resolve(scriptDir, '../vocabularies/experts.ucdavis.edu%2Fucop/pos_codes.jsonld')
  },

  logger : {
    name : 'harvest',
  }
}


export default config;