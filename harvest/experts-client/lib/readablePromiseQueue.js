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
    performance.mark(this.name);
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
            this.logger.info({measure:[this.name],queue:{name:this.name,max:this.max_promises}},`resolved`);
            performance.clearMarks(this.name);
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
      this.logger.info({queue:{
        name:this.name,
        first_next:first_next,
        pending:pending_promises,
        queue:this.queue.length,
        via}},'promise');
    }
  }

}

export default readablePromiseQueue;
