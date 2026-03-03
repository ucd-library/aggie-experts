import path from 'path';
import os from 'os';
import fs from 'fs-extra';

let isBrowser = (typeof window !== 'undefined' && typeof window.document !== 'undefined');
const nodeEnv = (typeof process !== 'undefined' && process?.env) ? process.env : {};
const scriptDir = !isBrowser ? path.dirname(new URL(import.meta.url).pathname) : '';

let env = {};
if( !isBrowser ) {
  env = nodeEnv;
} else {
  env = window.__env__ || {};
}

const esHostname = env.ES_HOST || 'elasticsearch';
const esPort = parseK8sPort(env.ES_PORT || 9200);
const userConfigDir = !isBrowser ? (env.EXPERTS_USER_CONFIG_DIR || path.join(os.homedir(), '.ae')) : null;
const userConfigFile = !isBrowser ? path.join(userConfigDir, 'harvest.json') : null;

if (!isBrowser && !fs.existsSync(userConfigDir)) {
  fs.mkdirSync(userConfigDir, { recursive: true });
}

let userConfigData = {};
if( !isBrowser && fs.existsSync(userConfigFile) ) {
  userConfigData = JSON.parse(fs.readFileSync(userConfigFile));
}

const config = {

  timezone : env.EXPERTS_HARVEST_TIMEZONE || 'America/Los_Angeles',

  userDomain : env.EXPERTS_USER_DOMAIN || '@ucdavis.edu',

  userConfig : {
    rootDir : userConfigDir,
    configFile : userConfigFile,
    data : userConfigData || {},  

    get : (key, defaultValue=null) => {
      return config.userConfig.data[key] || defaultValue;
    },
    set : (key, value) => {
      config.userConfig.data[key] = value;
      if( !isBrowser && config.userConfig.configFile ) {
        fs.writeFileSync(config.userConfig.configFile, JSON.stringify(config.userConfig.data, null, 2));
      }
    },

    get serviceAccountFile() {
      return this.get('serviceAccountFile', env.GOOGLE_APPLICATION_CREDENTIALS);
    },
    set serviceAccountFile(file) {
      this.set('serviceAccountFile', file);
    }
  },

  reporting : {
    enabled : env.ETL_REPORTING_ENABLED || false,
    jobId : env.ANDUIN_JOB_ID || (!isBrowser ? 'user:' + os.userInfo().username : 'browser'),
    userId : null,
    command : null,
    commandId : null,
    opts : null
  },

  cache : {
    poolDbConnection : env.EXPERTS_CACHE_POOL_DB_CONNECTION || false,
    cdlDir : env.EXPERTS_CDL_CACHE_DIR || 'cdl',
    iamDir : env.EXPERTS_IAM_CACHE_DIR || 'iam',
    aeStdFormatDir : env.EXPERTS_AE_STD_FORMAT_CACHE_DIR || 'ae-std',
    aeWebappDir : env.EXPERTS_AE_WEBAPP_CACHE_DIR || 'ae-webapp',
    // keycloakDir : env.EXPERTS_KEYCLOAK_CACHE_DIR || 'keycloak',
    keycloakUserFilename : 'keycloak.json',
    cdlUserFilename : 'user_000.json',
    iamUserFilename : 'profile.json',

    autoPathPartitions : [{
      name : 'year-week',
      filterRegex : /^\d{4}-\d{2}$/
    },{
      name : 'user',
      filterRegex : /^.*\@.*$/
    },{
      name : 'transform-type',
      filterRegex : /^(cdl|iam|ae-std|ae-webapp)$/,
      getValue : 'return regexMatch[1]'
    }],

    gcs : {
      enabled : env.EXPERTS_CACHE_GCS_ENABLED || false,
      bucketName : env.EXPERTS_CACHE_BUCKET_NAME || 'experts-harvest-test-cache',
    }
  },

  elasticsearch : {
    host : esHostname,
    port : esPort,
    username : env.ES_USERNAME || 'elastic',
    password : env.ES_PASSWORD || 'elastic',
    get connStr () {
      return `http://${this.host}:${this.port}`
    },
    indexes : {
      experts : env.ES_INDEX_EXPERTS || 'experts',
      works : env.ES_INDEX_WORKS || 'works',
      grants : env.ES_INDEX_GRANTS || 'grants'
    },
    aliases : {
      current : 'current',
      stage : 'stage'
    }
  },

  postgres : {
    host : env.POSTGRES_HOST || 'postgres',
    port : parseK8sPort(env.POSTGRES_PORT || 5432),
    user : env.POSTGRES_USER || 'postgres',
    password : env.POSTGRES_PASSWORD || 'postgres',
    database : env.POSTGRES_DB || 'postgres',
    schemaFile : !isBrowser ? path.resolve(scriptDir, './reporting/schema.sql') : null,
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
    ucopFile : !isBrowser ? path.resolve(scriptDir, '../vocabularies/experts.ucdavis.edu%2Fucop/pos_codes.jsonld') : null
  },

  logger : {
    name : 'harvest',
  },

  transform: {
    // enable sorting of ae-std output files for debugging
    stdSort: (env.EXPERTS_STD_SORT === 'true')
  },

  dagster : {
    host : env.DAGSTER_HOST || 'http://dagster-ui:3000/dagster',
    graphqlPath : env.DAGSTER_GRAPHQL_PATH || '/graphql',
    databaseName : env.DAGSTER_DATABASE_NAME || 'dagster',
    repositoryLocationName : env.DAGSTER_REPOSITORY_LOCATION_NAME || 'defs.py',
    repositoryName : env.DAGSTER_REPOSITORY_NAME || '__repository__',
    partitions : {
      user : env.DAGSTER_PARTITION_USER || 'users',
      yearWeek : env.DAGSTER_PARTITION_YEAR_WEEK || 'year-week'
    },
    etlPartitionSet : env.DAGSTER_ETL_PARTITION_SET || 'etl_users_job_partition_set',
    jobs : {
      etlUsersJob : env.DAGSTER_ETL_USERS_JOB || 'etl_users_job',
      gcs_etl_users_job : env.DAGSTER_GCS_ETL_USERS_JOB || 'gcs_etl_users_job'
    }
  }
}

function parseK8sPort(value) {
  if (typeof value === 'string') {
    const intValue = parseInt(value);
    if (!isNaN(intValue)) {
      return intValue;
    }

    if( value.startsWith('tcp:') ) {
      return parseInt(value.split(':').pop());
    }
  }
  return value;
}


export default config;