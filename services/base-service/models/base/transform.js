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
  let framed = await jsonld.frame(item, frame,{omitGraph:false});

  // Order authors by rank
  if (! Array.isArray(framed["@graph"])) {
    framed["@graph"]= [ framed["@graph"] ];

  framed["@graph"]?.forEach((node)=>{
    // alter the author(s) by rank, always an array as well.
    if (node?.["author"]) {
      if (! Array.isArray(node["author"])) {
        node["author"] = [ node["author"] ];
      } else {
        node["author"].sort((a,b)=>a["rank"]-b["rank"])
      }
    }
  });

  framed["@id"] = path;
  framed["@context"] = "info:fedora/context/experts.json";
  return framed;
}
