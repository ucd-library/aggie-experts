const { config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');

class ApiUtils {
  constructor() {
    // Initialization code
  }

  // Method to sanitize a single document.
  sanitize(doc) {

    let newDoc = {};

    for (let i = 0; i < doc["@graph"].length; i++) {
      logger.info({ function: "sanitize" }, `${doc["@graph"][i]["@id"]}`);
      if ((("is-visible" in doc["@graph"][i])
        && doc["@graph"][i]?.["is-visible"] !== true) ||
        (doc["@graph"][i].relatedBy && ("is-visible" in doc["@graph"][i].relatedBy)
          && doc["@graph"][i]?.relatedBy?.["is-visible"] !== true)) { // remove this graph node
        if (doc["@graph"][i]?.["@type"] === "Expert") {
          res.status(404).json(`${req.path} resource not found`);
          // alternatively, we could return the parent resource
          //delete doc["@graph"];
          //break;
        } else {
          logger.info({ function: "sanitize" }, `_x_${doc["@graph"][i]["@id"]}`);
          doc["@graph"].splice(i, 1);
          i--;
        }
      } else { // sanitize this graph node
        logger.info({ function: "sanitize" }, `Deleting totalAwardAmount=${doc["@graph"][i]?.["totalAwardAmount"]}`);
        delete doc["@graph"][i]["totalAwardAmount"];
      }
    }
    return doc;
  }
}

module.exports = ApiUtils;
