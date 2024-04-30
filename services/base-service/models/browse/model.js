// Can use this to get the fin configuration
const BaseModel = require('../base/model.js');

/**
 * @class BrowseModel
 * @description Base class for Aggie Experts data models.
 */
class BrowseModel extends BaseModel {
  constructor(name='browse') {
    super(name);
  }
}

module.exports = BrowseModel;
