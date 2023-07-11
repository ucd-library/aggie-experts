const ioUtils = require('@ucd-lib/fin-api/lib/io/utils.js');
const jsonld = require('jsonld');
const context = require('./frame.jsonld.json');

const expand=jsonld.expand;
const hc = require('@digitalbazaar/http-client');
const kyPromise=hc.kyPromise;


module.exports = async function(path, graph, headers, utils) {
  let item = {"@id": "info:fedora"+path,
              "@version":1.1,
              "@graph": graph};

  console.log("kypromise");
  await kyPromise;
  console.log("kypromise done");

  let type = ["ucdlib:Person","ucdlib:Work","ucdlib:Authorship","vivo:Grant"];
  if (path.match(/^\/work/)) {
    type = "ucdlib:Work";
  }
  else if (path.match(/^\/person/)) {
    // This is a temp fix to test graphs in elastic search
    type = ["ucdlib:Person","ucdlib:Work"];
  }
  else if (path.match(/^\/authorship/)) {
    type = "ucdlib:Authorship";
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
  //let framed = await jsonld.expand(item);

  if (type==="ucdlib:Work"
      && framed?.["@graph"]?.[0]?.["relatedBy"]) {
    const author=[];
    let relatedBy = framed["@graph"][0]["relatedBy"];
    if (!Array.isArray(relatedBy)) {
      relatedBy = [relatedBy];
    }
    relatedBy
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
