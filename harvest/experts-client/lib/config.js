const env = process.env;

const config = {
  cache : {
    rootDir : env.EXPERTS_CACHE_ROOT_DIR || process.cwd(),
    cdlDir : env.EXPERTS_CDL_CACHE_DIR || 'ark:/87287/d7mh2',
    cdlUserFilename : 'user_000.jsonld',
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
  }
}


export default config;