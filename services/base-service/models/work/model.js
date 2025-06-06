// Can use this to get the fin configuration
const {logger } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
/**
 * @class WorkModel
 * @description Base class for Aggie Experts data models.
 */
class WorkModel extends BaseModel {

  static transformed_types = [ 'Work' ];

  static types = [
    "http://schema.library.ucdavis.edu/schema#Work"
  ];

  constructor(name='work') {
    super(name);
    const search_template = require(`./template/${name}.js`);
    this.search_template = search_template;
  }

  snippet(node) {
    let snip=super.snippet(node);
    return snip;
  }

  /**
   * @method promote_node_to_doc
   * @description Promotes some node fields to document fields
   * @param {Object} node
   * @returns {Object} : document
   **/
  promote_node_to_doc(node) {
    const doc = super.promote_node_to_doc(node);

    // mini citation info, if we need to expand
    ["type","container-title","status","issued","DOI","author","title","volume","issue","page","abstract"].forEach(key => {
      if (node[key]) doc[key] = node[key];
    });

    let authors = '';
    if (node.author) {
      if (node.author.length >= 1) {
        if (node.author[0].given) {
          authors = node.author[0].family + ', ' + node.author[0].given[0]+'.';
        } else {
          authors = node.author[0].family;
        }
      }
      if (node.author.length === 2) {
        if (node.author[1].given) {
          authors += "& "+node.author[1].family + ', ' + node.author[1].given[0]+'.';
        } else {
          authors += "& "+node.author[1].family;
        }
      }
      if (node.author.length > 2) {
        if(node.author.at(-1).given) {
          authors += "& "+node.author.at(-1).family + ', ' + node.author.at(-1).given[0]+'.';
        } else {
          authors += "& "+node.author.at(-1).family;
        }
        authors += " et al.";
      }
    }
    let container_title = '';
    if (Array.isArray(node["container-title"])) {
        container_title = node["container-title"][0];
            } else {
        container_title = node["container-title"];
    }
    // quick hack to get the title
    doc.name =  node.title+" § "+
      (node.status ?? "")+" • "+
      (node.type ?? "")+" • "+
      (node.issued ?? "")+" • "+
      authors+" § "+
      container_title+" • "+((node.eissn ?? node.ISSN) ?? "")+" § "+
      (node.DOI ?? "")

    return doc;
  }

  async seo(id) {
    let node = await this.get(id);
    node = this.subselect(node);
    let seo = {"@context": node['@context'],
                "@graph": []
               };
    node['@graph'].forEach(async (node) => {
      if (node['@type']) {
        if (!Array.isArray(node['@type'])) {
          node['@type'] = [node['@type']];
        }
        // if type work, use model seo function to parse
        if (node['@type'].includes('Work')) {
          seo["@graph"].push(this.to_seo(node));
        }
      }
    });
    return JSON.stringify(seo);
  }

  to_seo(node) {
    if (!Array.isArray(node['@type'])) {
      node['@type'] = [node['@type']];
    }
    if(! node['@type'].includes("Work")) {
      log.error(node,"WorkModel.to_seo: node is not a work");
    }
    let seo={}

    seo.name = node?.title;
    seo.datePublished = node?.issued;
    if (node.DOI) {
      seo.identifier = 'doi:'+node?.DOI
      seo.sameAs = 'https://doi.org/'+node?.DOI
    }
    seo.abstract = node?.abstract;

    seo['@type'] = node['@type'].filter((t) => {
      return ["Book", "Chapter", "ScholarlyArticle"].includes(t);
    });
    return seo;
  }

    /**
   * @method subselect
   * @description return all or part of a document.  While this only really santiizes the authorships, we maintain the name to match the expert model.
   * @param {Object} doc
   * @param {Object} options, ie {admin:true|false, is-visible:true|false}
   * @returns {Object} : document
   * @example
        *  subselect(doc, {admin:false, is-visible:true})
   **/
  subselect(doc, options={}) {
    let relatedBy = doc['@graph'][0].relatedBy;

    // make doc.relatedBy an array if it is only one object
    if(relatedBy && !Array.isArray(relatedBy) ) {
      relatedBy = [relatedBy];
    }

    // by default, filter out hidden works/grants if not requested to include them, or if not admin/expert
    if( options['is-visible'] !== false || !options.admin ) {
      // Still honor the is-visible flag at doc level.
      if (doc["is-visible"] === false) {
        throw {status: 404, message: "Not found"};
      }
      relatedBy = relatedBy.filter(r => r['is-visible']);
    }

    // if doc.relatedBy is empty, doc isn't visible
    if( relatedBy.length === 0 ) {
      throw {status: 404, message: "Not found"};
    }

    return doc;
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.

     The current method matches the grants, version expecting authorships to be
     in the work itself and not as a seperate node
   */
  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);

    const relatedBy = {};

    // combine relatedBy (ordered)
    function addRelatedBy(node) {
      if (node.relatedBy) {
        Array.isArray(node.relatedBy) || (node.relatedBy = [node.relatedBy]);
        node.relatedBy.forEach((rel) => {
          relatedBy[rel['@id']] = rel;
          });
      }
    }

    try {
      let existing = await this.client_get(root_node['@id']);
      existing = this.get_expected_model_node(existing);
      addRelatedBy(existing);
    } catch(e) {
      //logger.info(`WorkModel.update: ${root_node['@id']} not found`);
    }
    addRelatedBy(root_node);

    // foreach relatedBy, fetch the expert
    const expertModel=await this.get_model('expert');
    const experts=[];
    for (var rel in relatedBy) {
      let authorship = relatedBy[rel];
      // Some authorships wants is visible to be set
      if (authorship["is-visible"]==true) {
        root_node["is-visible"]=true;
      }
      for(let i=0; i<authorship.relates.length; i++) {
          let related=authorship.relates[i];
          if (related.match(/^expert/)) {
            let expert=await expertModel.client_get(related);
            expert=expertModel.get_expected_model_node(expert);
            experts.push(expert);
          }
        }
    }
    root_node.relatedBy = Object.values(relatedBy);
    const doc = this.promote_node_to_doc(root_node);
    await this.update_or_create_main_node_doc(doc);
    const work_snippet = this.snippet(root_node);
    for (var i in experts) {
      let expert = experts[i];
      try {
        await this.update_graph_node(doc['@id'], expertModel.snippet(expert));
        logger.info(`Work.update() ${doc['@id']} <== ${expert['@id']}`);
      } catch(e) {
        logger.info(`Work.update() ${doc['@id']} <XX ${expert['@id']}`);
      }
      try {
        // only add in that experts relations
        let relatedBy = work_snippet.relatedBy;
        relatedBy = relatedBy.filter
        (w => w['is-visible'] && w.relates.some(r => r === expert['@id']));
        if (relatedBy.length > 0) {
          expertModel.update_graph_node
          (expert['@id'],
           {...work_snippet, relatedBy: relatedBy});
        } else {
          expertModel.update_graph_node(expert['@id'], work_snippet);
        }
        logger.info(`Work.update() ${doc['@id']} ==> ${expert['@id']}`);
      } catch(e) {
        logger.info(`Work.update() ${doc['@id']} XX> ${expert['@id']}`);
      }
    }
  }
}
module.exports = WorkModel;
