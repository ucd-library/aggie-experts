const ioUtils = require('@ucd-lib/fin-api/lib/io/utils.js');

module.exports = async function(path, graph, headers, utils) {
  let item = {};

  let container = utils.get(path, graph);
  let gitsource = utils.get(ioUtils.TYPES.GIT_SOURCE, graph);

  if( !container ) {
    throw new Error('unknown container: '+path);
  }


  utils.init(item, container);


  if( !utils.isType(container, 'http://fedora.info/definitions/v4/repository#Resource') ) {
    throw new Error('invalid type');
  }

  utils.ns({
    "fedora" : "http://fedora.info/definitions/v4/repository#",
    "fast": "http://id.worldcat.org/fast/",
    "lcna": "http://id.loc.gov/authorities/names/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "schema": "http://schema.org/",
    "ucdlib": "http://digital.ucdavis.edu/schema#",
    "premis" : "http://www.loc.gov/premis/rdf/v1#",
    "ebucore" : "http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#"
  });

  await utils.add({
    attr : 'name',
    value : ['rdfs', 'label'],
    default : ''
  });

  await utils.add({
    attr : 'hasContactInfo',
    value : ['schema', 'hasContactInfo'],
    type : 'id'
  });

  await utils.add({
    attr : 'hasName',
    value : ['vcard', 'hasName'],
    type : 'id'
  });

  utils.stripFinHost(item);

  utils.setYearFromDate(item);

  item._ = {};
  utils.stripFinHost(headers);

  return item;
}
