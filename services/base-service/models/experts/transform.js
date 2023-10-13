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

  // now we need to promote some items to the top level
  const root=framed["@graph"][0];
  if (! Array.isArray(root["@type"])) {
    root["@type"] = [ root["@type"] ];
  }
  root["@type"]?.forEach((type)=>{
    let name;
    switch (type) {
    case "Work":

      // alter the author(s) by rank, always an array as well.
      if (framed["@graph"]?.[0]?.["author"]) {
        //    console.log("framed author isArray", Array.isArray(framed["@graph"][0]["author"]));
        if (! Array.isArray(framed["@graph"][0]["author"])) {
          framed["@graph"][0]["author"] = [ framed["@graph"][0]["author"] ];
        } else {
          framed["@graph"][0]["author"].sort((a,b)=>a["rank"]-b["rank"])
        }
      }

      framed["@type"] = "Work";
      name= `${root?.title} § ${root?.issued} · ${root?.["container-title"]} · ${root?.author?.[0]?.family} · DOI:${root?.DOI}`;
      if (root?.author?.length > 1) {
        name += " et al";
      }
      framed["name"] = name;
      ["title","issued","container-title","author","DOI","type"].forEach((key)=>{
        if (root?.[key]) {
          framed[key] = root[key];
        }
      });
      framed["@type"] = "Work";
      break;
    case "Person":
      framed["@type"] = "Expert";

      // Order the vcards, and get the first one
      let contact
      let hasEmail=[];
      let hasURL=[];
      if (root["contactInfo"]) {
        if (! Array.isArray(root["contactInfo"])) {
          root["contactInfo"] = [ root["contactInfo"] ];
        } else {
          root["contactInfo"].sort((a,b)=>a["rank"]-b["rank"])
        }
        contact = root["contactInfo"]?.[0];
        // get the hasURL
        root["contactInfo"].forEach((info)=>{
          if (info.hasEmail) {
            hasEmail=hasEmail.concat(info.hasEmail);
          }

          if (info?.hasURL) {
            hasURL=hasURL.concat(info.hasURL);
          }
        });
      }

      framed["contactInfo"] = {};

      if (hasURL.length > 0) {
        framed.contactInfo["hasURL"] = hasURL;
      }

      framed.contactInfo["hasEmail"] = hasEmail?.[0];

      ["name","hasName","hasTitle","hasOrganizationalUnit"].forEach((key)=>{
        if (contact[key]) {
          framed.contactInfo[key] = contact[key];
        }
      });
      if (framed.contactInfo.name) {
        framed.name = framed.contactInfo.name;
      }
      break;
    }
  });

  framed["@id"] = path.replace(/^\//,"");
  framed["@context"] = "info:fedora/context/experts.json";
  return framed;
}
