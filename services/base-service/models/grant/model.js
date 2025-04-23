const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
/**
 * @class GrantModel
 * @description Base class for Aggie Experts data models.
 */
class GrantModel extends BaseModel {

  static transformed_types = [ 'Grant' ];

  static types = [
    "http://vivoweb.org/ontology/core#Grant"
  ];

  constructor(name='grant') {
    super(name);
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

    // mini grant info, if we need to expand
    ["sponsorAwardId","assignedBy","dateTimeInterval","relatedBy"].forEach(key => {
      if (node[key]) doc[key] = node[key];
    });

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
    if(! node['@type'].includes("Grant")) {
      log.error(node, "not a grant");
    }
    let seo={}

    seo.name = node?.name;
    seo.datePublished = node?.issued;

    seo['@type'] = node['@type'].filter((t) => {
      return ["Grant"].includes(t);
    });
    return seo;
  }

  /**
   * @method subselect
   * @description return all or part of a document. If the document is not visible, throw 404
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
      // I'm not quite sure about this, if you are an expert on a grant, you can see all other (even non visible) experts as well. I guess that's correct.
      relatedBy = relatedBy.filter(r => r['is-visible']);
      delete doc['@graph'][0].totalAwardAmount;
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
      existing=this.get_expected_model_node(existing);
      addRelatedBy(existing);
    } catch(e) {
    }
    addRelatedBy(root_node);

    // for each value in relatedBy, if it has .inheres_in, fetch expert
    function nameMatches(name) {
      const name_match={}
      let last=name.family.toLowerCase().replace(/[^a-z]/g,'');
      if (name.given && name.given.length) {
        let first=name.given.toLowerCase().replace(/[^a-z]/g,'');
        name_match[`${last}_${first}`]=true;
        name_match[`${last}_${first[0]}`]=true;
        if (name.middle && name.middle.length) {
          let middle=name.middle.toLowerCase().replace(/[^a-z]/g,'');
          name_match[`${last}_${first[0]}${middle[0]}`]=true;
        }
      } else if (name.middle && name.middle.length) {
        let middle=name.middle.toLowerCase().replace(/[^a-z]/g,'');
        name_match[`${last}_${middle[0]}`]=true;
      } else {
        name_match[last]=true;
      }
      return Object.keys(name_match);
    }

    const expertModel = await this.get_model('expert');
    // get all name matches
    const name_match = {}
    const experts=[];
    const vis=[]
    for (var rel in relatedBy) {
      let role=relatedBy[rel];
      if (role.inheres_in) {
        if (role["is-visible"]) {
          vis.push(role);
        }

        let id = role.inheres_in['@id'] || role.inheres_in;
        let expert = await expertModel.client_get(role.inheres_in);
          expert=expertModel.get_expected_model_node(expert);
        experts.push(expert);
          if (expert?.hasName) {
            nameMatches(expert?.hasName).forEach((n) => {
              name_match[n]=role.inheres_in;
            });
          }
      }
    }
    // finally remove relatedBy with names that match experts
    for (const rel in relatedBy) {
      let role=relatedBy[rel];
      if (! role.inheres_in && role?.relates) {
        role.relates.forEach(r => {
          if (r.hasName) {
            nameMatches(r.hasName).forEach((nm) => {
              if (name_match[nm]) {
                delete relatedBy[rel];
              }
            })
          }
        });
      }
    }
    root_node.relatedBy=Object.values(relatedBy);
    const doc = this.promote_node_to_doc(root_node);

    // replace expert @id with { @id:expert/ldxxxx, name="Quinn Hart" }
    doc.relatedBy = JSON.parse(JSON.stringify(doc.relatedBy));
    for( var i in doc.relatedBy ) {
      if( doc.relatedBy[i].inheres_in ) {
        let id = doc.relatedBy[i].inheres_in;
        let expert = experts.find(e => e['@id'] === id);
        if( expert ) {
          doc.relatedBy[i]['@id'] = { '@id': expert['@id'], name: expert.label };
        }
      }
    }

    if (vis.length) {
      root_node["is-visible"]=true;
      doc["is-visible"]=true; // Some expert wants it visible
    } else {
      root_node["is-visible"]=false;
      doc["is-visible"]=false; // No experts want it visible
    }
    await this.update_or_create_main_node_doc(doc);

    const grant_snippet = this.snippet(root_node);
    for (var i in experts) {
      let expert = experts[i];
      try {
        await this.update_graph_node(doc['@id'], expertModel.snippet(expert));
        logger.info(`GrantModel.update() ${doc['@id']} <== ${expert['@id']}`);
      } catch(e) {
        logger.info(`GrantModel.update() ${doc['@id']} <XX ${expert['@id']}`);
      }
      try {
        expertModel.update_graph_node(expert['@id'], grant_snippet);
        logger.info(`GrantModel.update() ${doc['@id']} ==> ${expert['@id']}`);
      } catch(e) {
        logger.info(`GrantModel.update() ${doc['@id']} XX> ${expert['@id']}`);
      }
    }
  }
}
module.exports = GrantModel;
