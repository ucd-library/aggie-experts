import {version} from './version.js';
export default class Schema {

  const frames = {};
  const contexts = {};

  static async frame(id,version) {
    const {major, minor} = version;
    return frames[version];
  }

  static async context(id,version) {
    return contexts[version];
  }
}
