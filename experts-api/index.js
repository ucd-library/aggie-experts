import defaultFrame from './lib/frames/default.json' assert { type: 'json' };
import GoogleSecret from './lib/googleSecret.js';
import ElementsClient from './lib/elements-client.js';

export const frames = {
  default: defaultFrame
};

export { GoogleSecret ElementsClient };
