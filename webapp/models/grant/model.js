const {logger} = require('@ucd-lib/experts-commons');

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
        // if type grant, use model seo function to parse
        if (node['@type'].includes('Grant')) {
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

    let startDate = node?.dateTimeInterval?.start?.dateTime;
    let endDate = node?.dateTimeInterval?.end?.dateTime;
    if( startDate || endDate ) {
      seo.fundedItem = {
        '@type': 'Event',
        name: node?.name || ''
      };
      if( startDate ) seo.fundedItem.startDate = startDate;
      if( endDate ) seo.fundedItem.endDate = endDate;
    }

    if( node.assignedBy ) {
      seo.funder = {
        "@type": "Organization",
        name: node.assignedBy?.name || '',
        identifier: node.assignedBy['@id'] || ''
      };
    }

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
    // console.log("GrantModel.subselect()"); This is in uber
    // Grants should be only public data always
    return doc;
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */
  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);

    // combine relatedBy (ordered)
    function get_inheres_in(node) {
      const inheres_in = {};
      if (node.relatedBy) {
        Array.isArray(node.relatedBy) || (node.relatedBy = [node.relatedBy]);
        node.relatedBy.forEach((rel) => {
          if (rel.inheres_in ) {
            inheres_in[rel.inheres_in] = rel;
          }
        });
      }
      return inheres_in
    }

    let inheres_in={}
    try {
      let existing = await this.client_get(root_node['@id']);
      existing=this.get_expected_model_node(existing);
      inheres_in={...get_inheres_in(existing)};
    } catch(e) {
    }
    inheres_in={...inheres_in,...get_inheres_in(root_node)}
    const visible_inheres_in = {}
    for (const i in inheres_in) {
      if (inheres_in[i]['is-visible'] === true) {
        visible_inheres_in[i] = inheres_in[i];
      }
    }

    const expertModel = await this.get_model('expert');
    const experts={};
    // Make sure some expert wants it visible
    for (var expert_id in visible_inheres_in) {
      let expert = await expertModel.client_get(expert_id);
      expert=expertModel.get_expected_model_node(expert);
      experts[expert_id]=expert;
      if (expert?.hasName) {
        // Add a label to the role
        let role=visible_inheres_in[expert_id];
        for ( var j in role.relates ) {
          let rel = role.relates[j];
          if ( rel === expert_id ) {
              role.relates[j] = { '@id': expert['@id'], name: expert.label };
          }
        }
      }
    }
    const new_related = [...Object.values(visible_inheres_in)];

    for (const role of
         Array.isArray(root_node.relatedBy)?root_node.relatedBy:[root_node.relatedBy])
    {
      // Skip dangling {@id} stubs. These are leftover @id references in
      // relatedBy whose underlying role node was dropped upstream (typically
      // by harvest/lib/transform/webapp/relates.js _dropRedundantRoleofNodes)
      // but whose reference jsonld framing didn't strip. They have no
      // @type/inheres_in/relates, so neither branch below would do anything
      // useful with them — the else branch in particular would call
      // update_graph_node(undefined, ...) and log a noisy XX> error.
      if (!role || (!role['@type'] && !role.inheres_in && !role.relates)) {
        continue;
      }

      if (! role.inheres_in && role?.relates) {
        // Non-AE-expert person role (#roleof_). Redundant ones (where an AE
        // expert covers the same person+role) are dropped upstream in
        // harvest/lib/transform/webapp/relates.js, so anything that reaches
        // here is genuine and should be rendered.
        new_related.push(role)
      } else {
        try {
          await expertModel.update_graph_node(role.inheres_in, this.snippet(root_node));
          logger.info(`GrantModel.update() ${root_node['@id']} ==> ${role.inheres_in}`);
        } catch(e) {
          logger.info(`GrantModel.update() ${root_node['@id']} XX> ${role.inheres_in}`);
        }
      }
    }

    root_node.relatedBy = new_related;
    if (Object.keys(visible_inheres_in).length) {
      root_node["is-visible"]=true; // Some expert wants it visible
    } else {
      root_node["is-visible"]=false; // No experts want it visible
    }
    const doc = this.promote_node_to_doc(root_node);
    await this.update_or_create_main_node_doc(doc);

    for (var i in visible_inheres_in) {
      let expert = experts[i];
      try {
        await this.update_graph_node(doc['@id'], expertModel.snippet(expert));
        logger.info(`GrantModel.update() ${doc['@id']} <== ${expert['@id']}`);
      } catch(e) {
        logger.info(`GrantModel.update() ${doc['@id']} <XX ${expert['@id']}`);
      }
    }

    for (var expert_id in inheres_in) {
      if ( inheres_in[expert_id]['is-visible'] === false ) {
        try {
          await this.delete_graph_node(doc,expert_id);
          logger.info(`GrantModel.update() ${expert_id} from ${doc['@id']}`);
        } catch(e) {
          logger.info(`GrantModel.update() ${expert_id} from ${doc['@id']} failed`);
        }
      }
    }

  }
}
module.exports = GrantModel;
