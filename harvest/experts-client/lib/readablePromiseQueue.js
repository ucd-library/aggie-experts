'use strict';
import util from 'util';

export class readablePromiseQueue {
  constructor(readable, func, opts) {
    const opt = { ...{ name:'readablePromiseQueue',max_promises:10 }, ...opts };
    this.queue = [];
    this.readable = readable;
    this.func = func;
    this.max_promises = opt.max_promises;
    this.name = opt.name;
    this.logger = opt.logger;
    return this;
  }

  async execute() {
    // should decide if this is a promise or not
    this.readable = await this.readable;
    this.readable
      .on('readable', () => {
        this.readQueuedData({via:'readable'});
      })
      .on('error', (error) => {
        this.logger.error(error);
      })
      .on('end', () => {
        // this.logger.info(`${this.name} readable.end`);
      });
    this.readQueuedData({via:'execute'});

    await new Promise((resolve, reject) => {
      this.readable.on('end', () => {
        Promise.all(this.queue)
          .then( results => {
            this.logger.info(`${this.name} Promise.all resolved`);
            resolve(results); })
          .catch(error => { reject(error); });
      });
    });
    return this.queue;
  }

  async readQueuedData(opts) {
    const {via }={...{via:"read"}, ...opts};
    let pending_promises = 0;
    this.queue.forEach(promise => {
      if (util.inspect(promise).includes("pending")) {
        pending_promises++;
      }
    });
    const first_next=pending_promises;
    let bindings;
    while ((pending_promises <= this.max_promises) && (bindings=this.readable.read())) {
      this.queue.push(
        (async (b) => {
          await this.func(b);
          this.readQueuedData({via:'promise'});
        })(bindings));
      pending_promises++;
    }
    if (first_next!=pending_promises) {
      this.logger.info(`promise:(${first_next}:${pending_promises}/${this.max_promises}) via ${via}`);
    }
  }

}

export default readablePromiseQueue;
