const ioUtils = require('@ucd-lib/fin-api/lib/io/utils.js');
const jsonld = require('jsonld');

module.exports = async function(path, graph, headers, utils) {
  let item = {"@id": "info:fedora"+path,
              "@version":1.1,
              "@graph": graph};

  let frame={
    "@version":1.1,
    "@context":{
      "@base":"http://citationstyles.org/schema/",
      "@vocab":"http://citationstyles.org/schema/",
      "bibo":"http://purl.org/ontology/bibo/",
      "ucdrp":"http://experts.ucdavis.edu/schema#",
      "vivo":"http://vivoweb.org/ontology/core#",
      "rdfs":"http://www.w3.org/2000/01/rdf-schema#"
    },
    "@id":"info:fedora"+path,
    "@graph":{
	    "@type": "ucdrp:work"
    },
    "@embed":"@once"
  };

  let frame_no_graph={
    "@version":1.1,
    "@context":{
      "@base":"http://citationstyles.org/schema/",
      "@vocab":"http://citationstyles.org/schema/",
      "bibo":"http://purl.org/ontology/bibo/",
      "ucdrp":"http://experts.ucdavis.edu/schema#",
      "vivo":"http://vivoweb.org/ontology/core#",
      "rdfs":"http://www.w3.org/2000/01/rdf-schema#"
    },
    "@type": "ucdrp:work",
    "@embed":"@once"
  };

//    let framed = await jsonld.frame(item, frame);
    let framed = await jsonld.frame(item, frame_no_graph);
  framed["@id"] = "info:fedora"+path;
  return framed;
}
