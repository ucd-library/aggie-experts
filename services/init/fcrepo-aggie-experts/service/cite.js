const fetch = require ('node-fetch');

module.exports = async function(path, graph, headers, utils) {
  let item = {"@id": "info:fedora"+path,
              "@version":1.1,
              "@graph": graph};

  const res = await utils.request({uri:path+"/svc:node"});
  let framed = JSON.parse(res.body);

  // alter the author(s) by rank
  if (framed["@graph"]?.[0]?.["author"]) {
    const author=[];
    framed["@graph"][0]["author"]
      .sort((a,b)=>a.rank-b.rank)
      .forEach((a)=>{
        const name={};
        if (a.family) name.family=a.family;
        if (a.given) name.given=a.given;
        author.push(name);
      });
    framed["@graph"][0]["author"] = author;
  }

  const cite=framed["@graph"][0];
  cite.id=cite["@id"];
  ["@id","@type","hasPublicationVenue","lastModifiedTime","name"]
    .forEach((id)=>{delete cite[id];});
  return cite;
}
