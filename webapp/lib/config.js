const env = process.env;

const config = {

  url : env.AE_URL || 'http://localhost:3000',

  models : {
    rootDir : env.AE_MODEL_ROOT || '/app/models'
  },

  client : {
    serviceHost : env.AE_CLIENT_SERVICE_NAME || 'http://spa:3000',
  },

  api : {
    serviceHost : env.AE_API_SERVICE_NAME || 'http://api:3000',
    port : env.AE_API_PORT || 3000
  },

  oidc : {
    port : env.OIDC_PORT || 3000,
    clientId : env.OIDC_CLIENT_ID || '',
    baseUrl : env.OIDC_BASE_URL || 'https://auth.library.ucdavis.edu/realms/aggie-experts',
    secret : env.OIDC_SECRET || '',
    scopes : env.OIDC_SCOPES || 'roles openid profile email',
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

  proxy : {
    port : env.AE_GATEWAY_PORT || 3000,
    timeout : env.AE_GATEWAY_TIMEOUT || 1000 * 60 * 5,
    proxyTimeout : env.AE_GATEWAY_PROXY_TIMEOUT || 1000 * 60 * 5
  },

  jwt : {
    jwksUri : process.env.JWT_JWKS_URI,
    secret : process.env.JWT_SECRET,
    issuer : process.env.JWT_ISSUER,
    // expires in seconds
    ttl : process.env.JWT_TTL ? parseInt(process.env.JWT_TTL) : (60 * 60 * 24 * 14),
    cookieName : process.env.JWT_COOKIE_NAME || 'fin-jwt'
  },

  elasticsearch: {
    connStr: env.ELASTICSEARCH_CONN_STR || 'http://elasticsearch:9200',
    username: env.ELASTICSEARCH_USERNAME || 'elastic',
    password: env.ELASTICSEARCH_PASSWORD || 'changeme',
  },

  experts : {
    version : '1.0.0',
    is_public : ! (process.env.EXPERTS_IS_PUBLIC === "false")
  },

  server : {
      url : env.AE_EXPERTS_SERVER_URL || 'https//spa:3000'
  },

  dagster : {
    host : env.DAGSTER_HOST || 'http://dagster:3000',
    graphqlPath : env.DAGSTER_GRAPHQL_PATH || '/graphql',
    repositoryLocationName : env.DAGSTER_REPOSITORY_LOCATION_NAME || 'defs.py',
    repositoryName : env.DAGSTER_REPOSITORY_NAME || '__repository__',
    etlPartitionSet : env.DAGSTER_ETL_PARTITION_SET || 'etl_users_job_partition_set',
    jobs : {
      etlUsersJob : env.DAGSTER_ETL_USERS_JOB || 'etl_users_job',
      gcs_etl_users_job : env.DAGSTER_GCS_ETL_USERS_JOB || 'gcs_etl_users_job'
    }
  }

}

module.exports = config;
