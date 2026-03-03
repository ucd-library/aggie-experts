import { getGraphAsItems } from '../utils.js';

class Graph {
  constructor() {
    this.nodes = new Map();
  }

  toRdfGraph() {
    return {
      "@graph": Array.from(this.nodes.values())
    }
  }

  addNodes(nodes) {
    nodes = getGraphAsItems(nodes);
    for(const node of nodes) {
      this.addNode(node);
    }
  }

  addNode(node) {
    if( !node['@id'] ) throw new Error(`Node must have an @id: ${JSON.stringify(node)}`);
    this.nodes.set(node['@id'], node);
  }

  cleanNodes() {
    this.nodes.forEach(node => this.cleanNode(node));
  }

  cleanNode(node) {
    for(const prop in node) {
      if( Array.isArray(node[prop]) ) {
        node[prop].forEach(v => {
          if( typeof v === 'object' && v !== null ) {
            if( v['@value'] ) {
              this.cleanNodeProperty(node, prop, v);
              return;
            }
            this.cleanNode(v);
          } else if( typeof v === 'string' ) {
            this.cleanNodeProperty(node, prop, v);
          }
        });
      }
    }
  }

  cleanNodeProperty(node, property, value) {
    
  }

}

export { Graph }