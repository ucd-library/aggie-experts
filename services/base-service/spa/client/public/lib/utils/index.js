class Utils {
  /**
   * @method asArray
   * @description given a record object, return a key as an array.
   * If the key doesn't exist, the array will be empty.  Singletons will
   * be converted to single item arrays and keys that are already arrays
   * will be return as is.
   *
   * @param {Object} item most likely a JSON-LD record
   * @param {String} key key/attribute to access in item/record
   *
   * @return {Array}
   */
  asArray(item = {}, key) {
    let value = item[key] || [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * @method getCitationType
   * @description given a csl type, return a human readable string
   * https://github.com/citation-style-language/schema/blob/master/schemas/styles/csl-types.rnc
   *
   * @param {String} type
   *
   * @return {String} readable type
   */
  getCitationType(type) {
    let readableType = type;

    switch (type) {
      case 'article-journal':
        readableType = 'journal article';
        break;
      case 'paper-conference':
        readableType = 'conference paper';
        break;
      case 'article-magazine':
        readableType = 'magazine article';
        break;
      case 'article-newspaper':
        readableType = 'newspaper article';
        break;
      case 'entry-dictionary':
        readableType = 'dictionary entry';
        break;
      case 'entry-encyclopedia':
        readableType = 'encyclopedia entry';
        break;
      case 'post-weblog':
        readableType = 'weblog post';
        break;
      case 'review-book':
        readableType = 'book review';
        break;
      case 'motion_picture':
        readableType = 'motion picture';
        break;
      case 'musical_score':
        readableType = 'musical score';
        break;
      default:
        break;
    }

    return readableType;
  }

  /**
   * @method parseGrants
   * @description given an array of grants, parse and return an array of parsed grants
   *
   * @param {Array} grants
   *
   * @return {Array} parsedGrants
   */
  parseGrants(grants) {
    let parsedGrants = (grants || []).map((g, index) => {
      // determine if active or completed
      let completed = false;
      let now = new Date();
      let start = g.dateTimeInterval?.start?.dateTime;
      let end = g.dateTimeInterval?.end?.dateTime;
      if( start && end ) {
        start = new Date(start);
        end = new Date(end);
        completed = end < now;

        // determine start/end date
        g.start = start.getFullYear();
        g.end = end.getFullYear();
      }
      g.completed = completed;

      // determine role
      g.role = g['http://www.w3.org/1999/02/22-rdf-syntax-ns#type']?.name;

      // determine awarded-by
      g.awardedBy = g.assignedBy?.name;

      if( Array.isArray(g.name) ) g.name = g.name[0];

      return g;
    });

    parsedGrants.sort((a,b) => new Date(b.dateTimeInterval?.end?.dateTime) - new Date(a.dateTimeInterval?.end?.dateTime));

    /*
    {
      "assignedBy": {
          "@type": "FundingOrganization",
          "name": "NASA/MISCELLANEOUS CENTERS",
          "@id": "ark:/87287/d7mh2m/grant/4316321#unknown-funder"
      },
      "dateTimeInterval": {
          "@type": "DateTimeInterval",
          "start": {
              "dateTime": "2011-05-01",
              "@type": "DateTimeValue",
              "@id": "ark:/87287/d7mh2m/grant/4316321#start-date",
              "dateTimePrecision": "vivo:yearMonthDayPrecision"
          },
          "end": {
              "dateTime": "2015-04-30",
              "@type": "DateTimeValue",
              "@id": "ark:/87287/d7mh2m/grant/4316321#end-date",
              "dateTimePrecision": "vivo:yearMonthDayPrecision"
          },
          "@id": "ark:/87287/d7mh2m/grant/4316321#duration"
      },
      "@type": [
          "Grant",
          "vivo:Grant"
      ],
      "totalAwardAmount": "783000",
      "name": "NEAR REAL TIME SCIENCE PROCESSING ALGORITHM FOR LIVE FUEL MOISTURE CONTENT FOR THE MODIS DIRECT READOUT SYSTEM",
      "@id": "ark:/87287/d7mh2m/grant/4316321",
      "relatedBy": {
          "relates": [
              "expert/66356b7eec24c51f01e757af2b27ebb8",
              "ark:/87287/d7mh2m/grant/4316321"
          ],
          "@type": "GrantRole",
          "@id": "ark:/87287/d7mh2m/relationship/13338362",
          "is-visible": true
      },
      "sponsorAwardId": "NNX11AF93G",
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": {
          "name": "Research",
          "@id": "ucdlib:Grant_Research"
      }
    }
    */
   return parsedGrants;
  }

}

module.exports = new Utils();
