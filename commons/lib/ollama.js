import config from "./config.js";
import {Ollama} from 'ollama';

class OllamaWrapper {
  constructor(opts={}) {
    this.client = new Ollama({
      host: opts.host || config.llm.host,
      model: opts.model || config.llm.model
    })
  }

  chat(opts) {
    return this.client.chat(opts);
  }

  generate(opts) {
    return this.client.generate(opts);
  }
}

export default OllamaWrapper;