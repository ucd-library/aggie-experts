const ioUtils = require('@ucd-lib/fin-api/lib/io/utils.js');
const jsonld = require('jsonld');

module.exports = async function(path, graph, headers, utils) {
  let item = {"@id": "info:fedora"+path,
              "@version":1.1,
              "@graph": graph};

  let frame={
    "@version":1.1,
    "@context": {
      "@vocab": "http://vivoweb.org/ontology/core#",
      "experts": "http://experts.ucdavis.edu/",
      "harvest_iam": "http://iam.ucdavis.edu/",
      "iam": "http://iam.ucdavis.edu/schema#",
      "obo": "http://purl.obolibrary.org/obo/",
      "person": "info:fedora/person/",
      "personx": "http://experts.ucdavis.edu/person/",
      "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
      "ucdrp": "http://experts.ucdavis.edu/schema#",
      "vcard": "http://www.w3.org/2006/vcard/ns#",
      "vivo": "http://vivoweb.org/ontology/core#",
      "xsd": "http://www.w3.org/2001/XMLSchema#",
      "hasContactInfo": {
        "@id": "obo:ARG_2000028",
        "@context": {
          "@vocab": "http://www.w3.org/2006/vcard/ns#",
          "hasEmail": {
            "@type": "@id"
          }
        }
      },
      "name": "rdfs:label"
    },
    "@id":{},
    "@graph":{
      "@type":"ucdrp:person"
    },
    "@embed": "@always",
    "@omitDefault": true
  };

  let frame_no_graph={
    "@version":1.1,
    "@context": {
      "@vocab": "http://vivoweb.org/ontology/core#",
      "experts": "http://experts.ucdavis.edu/",
      "harvest_iam": "http://iam.ucdavis.edu/",
      "iam": "http://iam.ucdavis.edu/schema#",
      "obo": "http://purl.obolibrary.org/obo/",
      "person": "info:fedora/person/",
      "personx": "http://experts.ucdavis.edu/person/",
      "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
      "ucdrp": "http://experts.ucdavis.edu/schema#",
      "vcard": "http://www.w3.org/2006/vcard/ns#",
      "vivo": "http://vivoweb.org/ontology/core#",
      "xsd": "http://www.w3.org/2001/XMLSchema#",
      "hasContactInfo": {
        "@id": "obo:ARG_2000028",
        "@context": {
          "@vocab": "http://www.w3.org/2006/vcard/ns#",
          "hasEmail": {
            "@type": "@id"
          }
        }
      },
      "name": "rdfs:label"
    },
    "@type":"ucdrp:person",
    "@embed": "@always",
    "@omitDefault": true
  };

  let framed = await jsonld.frame(item, frame_no_graph);
  framed["@id"] = "http://experts.ucdavis.edu"+path;
  delete framed["@context"];

  return framed;
//  return item;
}
