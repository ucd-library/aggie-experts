import path from 'path';
import os from 'os';
import fs from 'fs';

let isBrowser = (typeof window !== 'undefined' && typeof window.document !== 'undefined');
const nodeEnv = (typeof process !== 'undefined' && process?.env) ? process.env : {};
const scriptDir = !isBrowser ? path.dirname(new URL(import.meta.url).pathname) : '';

let env = {};
if( !isBrowser ) {
  env = nodeEnv;
} else {
  env = window.__env__ || {};
}

const esHostname = process.env.ES_HOST || 'elasticsearch';
const esPort = parseK8sPort(process.env.ES_PORT || 9200);

const BUILD_INFO_PATH = env.BUILD_INFO_PATH || '/cork-build-info';
const buildInfo = {};
if( fs.existsSync(BUILD_INFO_PATH) ) {
  let files = fs.readdirSync(BUILD_INFO_PATH);
  for( let file of files ) {
    let content = fs.readFileSync(path.resolve(BUILD_INFO_PATH, file), 'utf-8');
    buildInfo[file.replace('.json', '')] = JSON.parse(content);
  }
}

const config = {

  timezone : env.EXPERTS_HARVEST_TIMEZONE || 'America/Los_Angeles',

  userDomain : env.EXPERTS_USER_DOMAIN || '@ucdavis.edu',

  url : env.AE_URL || 'http://localhost:3000',

  buildInfo,

  experts : {
    version : '1.0.0',
    is_public : ! (env.EXPERTS_IS_PUBLIC === "false"),
    cdl: {
      expert: {
        propagate: (env.CDL_PROPAGATE_CHANGES === "true") || false,
        instance: env.CDL_PROPAGATE_CHANGES_INSTANCE || "qa" },
      grant_role: {
        propagate: (env.CDL_PROPAGATE_CHANGES === "true") || false,
        instance: env.CDL_PROPAGATE_CHANGES_INSTANCE || "qa" },
      authorship: {
        propagate: (env.CDL_PROPAGATE_CHANGES === "true") || false,
        instance: env.CDL_PROPAGATE_CHANGES_INSTANCE || "qa"
      }
    }
  },

  models : {
    rootDir : env.AE_MODEL_ROOT || '/opt/webapp/models'
  },

  client : {
    serviceHost : env.AE_CLIENT_SERVICE_NAME || 'http://spa:3000',
  },

  api : {
    serviceHost : env.AE_API_SERVICE_NAME || 'http://api:3000',
    port : env.AE_API_PORT || 3000
  },

  webappProxy : {
    port : env.AE_GATEWAY_PORT || 3000,
    timeout : env.AE_GATEWAY_TIMEOUT || 1000 * 60 * 5,
    proxyTimeout : env.AE_GATEWAY_PROXY_TIMEOUT || 1000 * 60 * 5
  },

  jwt : {
    jwksUri : env.JWT_JWKS_URI,
    secret : env.JWT_SECRET,
    issuer : env.JWT_ISSUER,
    // expires in seconds
    ttl : env.JWT_TTL ? parseInt(env.JWT_TTL) : (60 * 60 * 24 * 14),
    cookieName : env.JWT_COOKIE_NAME || 'fin-jwt'
  },

  oidc : {
    host : env.OIDC_HOST || 'https://auth.library.ucdavis.edu',

    clients : {
      webapp : {
        realm : env.OIDC_WEBAPP_REALM || 'aggie-experts',
        clientId : env.OIDC_WEBAPP_CLIENT_ID || 'anduin',
      },
      harvest : {
        realm : env.OIDC_HARVEST_REALM || 'aggie-experts',
        clientId : env.OIDC_HARVEST_CLIENT_ID || 'anduin',
      },
      admin : {
        realm : env.OIDC_ADMIN_REALM || 'aggie-experts',
        clientId : env.OIDC_ADMIN_CLIENT_ID || 'anduin',
      },
      miv : {
        realm : env.OIDC_MIV_REALM || 'aggie-experts-miv',
        clientId : env.OIDC_MIV_CLIENT_ID || 'miv',
      },
      sitefarm : {
        realm : env.OIDC_SITEFARM_REALM || 'aggie-experts-miv',
        clientId : env.OIDC_SITEFARM_CLIENT_ID || 'sitefarm',
      }
    },

    roles : {
      serviceAccountAccess : 'access',
      admin : 'admin',
    },

    scopes : env.OIDC_SCOPES || 'roles openid profile email',
    // service account login for path
    serviceName : env.OIDC_SERVICE_NAME || 'keycloak-oidc',
    roleIgnoreList : [
      "default-roles-dams",
      "uma_authorization",
      "manage-account",
      "manage-account-links",
      "view-profile",
      "offline_access"
    ],
    // default cache all tokens for 30 seconds before requesting verification again
    tokenCacheTTL : env.OIDC_TOKEN_CACHE_TTL ? parseInt(env.OIDC_TOKEN_CACHE_TTL) : (1000*60*5)
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
    // make sure updates here match dagsters lib/configs.py:LoadUserConfig & SetAliasConfig
    aliases : {
      current : 'public',
      stage : 'latest'
    }
  },

  postgres : {
    host : env.POSTGRES_HOST || 'postgres',
    port : parseK8sPort(env.POSTGRES_PORT || 5432),
    user : env.POSTGRES_USER || 'postgres',
    password : env.POSTGRES_PASSWORD || 'postgres',
    database : env.POSTGRES_DB || 'postgres',
    schemaFile : path.resolve(scriptDir, '../../harvest/lib/reporting/schema.sql'),
  },

  google : {
    applicationCredentials : process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId : process.env.GOOGLE_PROJECT_ID || 'aggie-experts',
    cacheSecrets : process.env.CACHE_GOOGLE_SECRETS !== 'false',
    secrets : {
      keycloakSecrets : 'keycloak-client-secrets'
    }
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
      secretName : 'cdl-elements-json',
      timeout : 30000
    },

    prod: {
      url : 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
      authname : 'oapolicy',
      secretName : 'cdl-elements-json',
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
      secretName: 'ucdid_auth',
      timeout: 30000
    },
    prod: {
      url: 'https://iet-ws.ucdavis.edu/api/iam',
      authname: 'iet-ws',
      secretName: 'ucdid_auth',
      timeout: 30000
    }
  },

  vocab : {
    ucopFile : path.resolve(scriptDir, 'vocabularies/experts.ucdavis.edu%2Fucop/pos_codes.jsonld')
  },

  logger : {
    name : env.SERVICE_NAME || 'aggie-experts',
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