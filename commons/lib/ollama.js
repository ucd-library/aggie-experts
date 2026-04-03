import config from "./config.js";
import {Ollama} from 'ollama';

class OllamaWrapper {
  constructor(opts={}) {
    let ollamaOpts = {
      host: opts.host || config.llm.host,
      model: opts.model || config.llm.model
    };
    if( opts.apiKey || config.llm.apiKey ) {
      ollamaOpts.headers = {
        'Authorization': `Bearer ${opts.apiKey || config.llm.apiKey}`
      };
    }
    this.client = new Ollama(ollamaOpts)
  }

  chat(opts) {
    return this.client.chat(opts);
  }

  generate(opts) {
    return this.client.generate(opts);
  }

  /**
   * @method embed
   * @description Generate embeddings for the given input using the ollama embed API.
   * @param {Object} opts - Ollama EmbedRequest options
   * @param {String} opts.model - model to use for embedding
   * @param {String|String[]} opts.input - text or array of texts to embed
   * @returns {Promise<Object>} EmbedResponse with embeddings array
   */
  embed(opts) {
    return this.client.embed(opts);
  }
}

export default OllamaWrapper;