const {ElasticSearchModel} = require('@ucd-lib/fin-service-utils');

class PersonModel extends ElasticSearchModel {

  constructor() {
    super('item');
    this.transformService = 'es-person-transform';
  }

  is(id, types=[]) {
    if( id.match(/^\/person\//) ) return true;
    return false;
  }

  async getFiles(id, files=[]) {
    let searchDocument = {
      "filters":{
        "directParent":{
            type:"keyword",
            value:[id],
            "op":"or"
        }
      }
    }
    let resp = await this.search(searchDocument, {allRecords: true, noLimit: true});

    let types;
    for( let result of resp.results ) {
      types = result['@type'] || [];
      if( types.includes('http://fedora.info/definitions/v4/repository#Resource') ) {
        files.push({
          filename: result.filename,
          path: result['@id'],
          fileFormat : result.fileFormat,
          fileSize : result.fileSize
        });
      } else if( types.includes('http://www.w3.org/ns/ldp#BasicContainer') ) {
        await this.getFiles(result['@id'], files);
      }
    }

    return files;
  }

}

module.exports = new PersonModel();
