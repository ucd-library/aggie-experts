// Can use this to get the fin configuration
const BaseModel = require('../base/model.js');

/**
 * @class SearchModel
 * @description Base class for Aggie Experts data models.
 */
class SearchModel extends BaseModel {
  constructor(name='search') {
    super(name);
  }
}

module.exports = SearchModel;
