const ioUtils = require('@ucd-lib/fin-api/lib/io/utils.js');
const jsonld = require('jsonld');
const context = {
  "@version": 1.1,
  "@context": {
    "@base": "http://experts.ucdavis.edu/",
    "@vocab": "http://vivoweb.org/ontology/core#",
    "bibo":"http://purl.org/ontology/bibo/",
    "cite": "http://citationstyles.org/schema/",
    "grant": "http://experts.ucdavis.edu/grant/",
    "obo": "http://purl.obolibrary.org/obo/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "ucdrp": "http://experts.ucdavis.edu/schema#",
    "vcard":"http://www.w3.org/2006/vcard/ns#",
    "vivo": "http://vivoweb.org/ontology/core#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",

    "DOI": {"@id":"cite:DOI"},
    "ISBN": {"@id":"cite:ISBN"},
    "ISSN":{"@id":"cite:ISSN"},
    "abstract":{"@id":"cite:abstract"},
    "assignedBy": { "@type":"@id"},
    "author":{"@id":"cite:author","@type":"@json"},
    "available-date":{"@id":"cite:available-date"},
    "collection-number":{"@id":"cite:collection-number"},
    "container-title":{"@id":"cite:container-title"},
    "dateTimeInterval": { "@type":"@id",
                          "@context":{
                            "start":{"@type":"@id"},
                            "end":{"@type":"@id"},
                            "dateTimePrecision":{"@type":"@id"}
                          }
                        },
    "directCosts": { "@id": "vivo:grantDirectCosts" },
    "edition":{"@id":"cite:edition"},
    "eissn":{"@id":"cite:eissn"},
    "familyName":{"@id":"vcard:familyName"},
    "genre":{"@id":"cite:genre"},
    "givenName":{"@id":"vcard:givenName"},
    "grantType":{ "@id":"ucdrp:grantType", "@type":"@id" },
    "hasName":{"@id":"vcard:hasName"},
    "hasPublicationVenue":{"@id":"vivo:hasPublicationVenue","@type":"@id"},
    "indirectCosts": { "@id": "ucdrp:grantIndirectCosts" },
    "is-open-access":{"@id":"ucdrp:is-open-access"},
    "issue":{"@id":"cite:issue"},
    "issued":{"@id":"cite:issued"},
    "keyword":{"@id":"cite:keyword"},
    "label":{"@id":"rdfs:label"},
    "language":{"@id":"cite:language"},
    "lastModifiedDateTime":{"@id":"ucdrp:lastModifiedDateTime","@type":"xsd:dateTime"},
    "license":{"@id":"cite:license"},
    "name":{"@id":"rdfs:label"},
    "medium":{"@id":"cite:medium"},
    "note":{"@id":"cite:note"},
    "pagination":{"@id":"cite:pagination"},
    "publisher":{"@id":"cite:publisher"},
    "publisher-place":{"@id":"cite:publisher-place"},
    "rank":{"@id":"vivo:rank"},
    "relatedBy":{"@type":"@id",
                 "@id":"vivo:relatedBy"
                },
    "relates": { "@type":"@id",
                 "@context":{
                   "role_person_name":{"@id":"ucdrp:role_person_name"},
                   "inheres_in":{"@id":"obo:RO_000052","@type":"@id"},
                   "relatedBy":{"@type":"@id"},
                   "name":{"@id":"rdfs:label"}
                 }
               },
    "sponsorAwardId": {"@id":"vivo:sponsorAwardId"},
    "status":{"@id":"cite:status"},
    "title":{"@id":"cite:title"},
    "totalAwardAmount": {"@id": "vivo:totaAwardAmount"},
    "type":{"@id":"cite:type"},
    "url":{"@id":"cite:url"},
    "volume":{"@id":"cite:volume"}
  }
}

module.exports = async function(path, graph, headers, utils) {
  let item = {"@id": "info:fedora"+path,
              "@version":1.1,
              "@graph": graph};

  console.log("path:",path);
  let type = ["ucdrp:person","ucdrp:work","vivo:Grant"];
  if (path.match(/^\/work/)) {
    type = "ucdrp:work";
  }
  else if (path.match(/^\/person/)) {
    type = "ucdrp:person";
  }
  else if (path.match(/^\/grant/)) {
    type = "vivo:Grant";
  }

  let frame={
    ...context,
    "@type":type,
    "@embed":"@once"
  };

  // Make this a named graph, currently this doesn't work,
  //frame["@id"] = "info:fedora"+path;
  //frame["@graph"] = { "@type":frame["@type"] };
  //delete frame["@type"];

  let framed = await jsonld.frame(item, frame,{omitGraph:false});

  if (type==="ucdrp:work") {
    const author=[];
    framed["@graph"][0]["relatedBy"]
      .sort((a,b)=>a.rank-b.rank)
      .forEach((work)=>{
        const name={};
        work.relates.forEach((rel)=>{
          if ((rel["@type"]==="vcard:Individual") && (rel["hasName"])) {
            console.log("rel:",rel);
            if (rel["hasName"]["familyName"]) {
              name.family = rel["hasName"]["familyName"];
            }
            if (rel["hasName"]["givenName"]) {
              name.given = rel["hasName"]["givenName"];
            }
          }});
        author.push(name);
      });
    framed["@graph"][0]["author"] = author;
  }
  framed["@id"] = "http://experts.ucdavis.edu"+path;
  framed["@context"] = "info:fedora/context/experts.json";
  return framed;
}
