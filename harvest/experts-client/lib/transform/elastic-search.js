import fs from 'fs-extra';
import path from 'path';
import jsonld from 'jsonld';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const contextPath = path.join(__dirname, '..', '..', '..', 'experts-api', 'lib', 'frames', '4', 'context.jsonld');
const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));

export async function frame(path, graph) {
  let item = {
    "@id": "info:fedora"+path,
    "@version":1.1,
    "@graph": graph
  };
  
  let frame={
    ...context,
    "@embed":"@once"
  };

  // Make this a named graph, currently this doesn't work,
  let framed = await jsonld.frame(item, frame,{omitGraph:false});
  
  // Order authors by rank
  if (! Array.isArray(framed["@graph"])) {
    framed["@graph"]= [ framed["@graph"] ];
  }

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
  framed["@context"] = config?.server?.url+"/api/schema/context.jsonld";
  return framed;
}