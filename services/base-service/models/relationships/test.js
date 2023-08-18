const ioUtils = require('@ucd-lib/fin-api/lib/io/utils.js');
const jsonld = require('jsonld');
//    "@vocab": "http://vivoweb.org/ontology/core#",
const context=require('./frame.jsonld.json');

const transform = require('./transform.js')

async function frameit() {
  const item = require('./test_item.jsonld.json');
  //let framed = await jsonld.frame(item, frame,{omitGraph:false});
  let framed = await transform('/work/foo',item);

  console.log(JSON.stringify(framed));
}

frameit();
