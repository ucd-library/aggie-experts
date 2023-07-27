const ioUtils = require('@ucd-lib/fin-api/lib/io/utils.js');
const jsonld = require('jsonld');
const context = require('./frame.jsonld.json');
const expand=jsonld.expand;

module.exports = async function(path, graph, headers, utils) {
  let item = {"@id": "info:fedora"+path,
              "@version":1.1,
              "@graph": graph};

  // At some point in the future, we may need to include one specific id in our
  // frame, burt for now, we just assume there is only one.  The @id would match
  // the ide of the path, modified to not include the server, and then possibly
  // adding the httpL://experts.ucdavis.edu/moniker.

  let frame={
    ...context,
    "@embed":"@once"
  };

  // Make this a named graph, currently this doesn't work,
  //frame["@id"] = "info:fedora"+path;
  //frame["@graph"] = { "@type":frame["@type"] };
  //delete frame["@type"];
  let framed = await jsonld.frame(item, frame,{omitGraph:false});

  // alter the author(s) by rank
  if (framed["@graph"]?.[0]?.["author"]) {
    framed["@graph"][0]["author"]=
      framed["@graph"][0]["author"]
      .sort((a,b)=>a.rank-b.rank)
  }
  framed["@id"] = path;
  framed["@context"] = "info:fedora/context/experts.json";
  return framed;
}
