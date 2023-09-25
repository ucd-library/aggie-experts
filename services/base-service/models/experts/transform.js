const ioUtils = require('@ucd-lib/fin-api/lib/io/utils.js');
const jsonld = require('jsonld');
const expand=jsonld.expand;

module.exports = async function(path, graph, headers, utils) {
  let item = {"@id": "info:fedora"+path,
              "@version":1.1,
              "@graph": graph};

  // At some point in the future, we may need to include one specific id in our
  // frame, burt for now, we just assume there is only one.  The @id would match
  // the ide of the path, modified to not include the server, and then possibly
  // adding the httpL://experts.ucdavis.edu/moniker.
  const  { frames } = await import('@ucd-lib/experts-api')

  let frame={
    ...frames.default,
    "@embed":"@once"
  };

  // Make this a named graph, currently this doesn't work,
  //frame["@id"] = "info:fedora"+path;
  //frame["@graph"] = { "@type":frame["@type"] };
  //delete frame["@type"];
  let framed = await jsonld.frame(item, frame,{omitGraph:false});

  // alter the author(s) by rank, always an array as well.
  if (framed["@graph"]?.[0]?.["author"]) {
    console.log("framed author isArray", Array.isArray(framed["@graph"][0]["author"]));
    if (! Array.isArray(framed["@graph"][0]["author"])) {
      framed["@graph"][0]["author"] = [ framed["@graph"][0]["author"] ];
    } else {
      framed["@graph"][0]["author"].sort((a,b)=>a["rank"]-b["rank"])
    }
  }
  framed["@id"] = path.replace(/^\//,"");
  framed["@context"] = "info:fedora/context/experts.json";
  return framed;
}
