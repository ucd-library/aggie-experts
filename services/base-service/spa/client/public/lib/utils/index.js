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

    // return title case
    return readableType.split(' ')
                       .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                       .join(' ');
  }

  /**
   * @method getGrantRole
   * @description given a GrantType vivo role @type, returns the role to display in AE. defaults to Researcher if no match
   *
   * @param {String | Array} type
   *
   * @return {String} readable roles
   */
  getGrantRole(roles) {
    let readableRole = 'Researcher';
    if( !Array.isArray(roles) ) roles = [roles];

    if( roles.includes('PrincipalInvestigatorRole') ) readableRole = 'Principal Investigator';
    else if( roles.includes('CoPrincipalInvestigatorRole') ) readableRole = 'Co-Principal Investigator';
    else if( roles.includes('LeaderRole') ) readableRole = 'Leader';

    return readableRole;
  }

  /**
   * @method parseGrants
   * @description given an array of grants, parse and return an array of parsed grants
   *
   * @param {String} expertId expertId to match for experts role in grant
   * @param {Array} grants array of grant objects
   * @param {Boolean} filterHidden whether to filter out hidden grants
   *
   * @return {Array} parsedGrants
   */
  parseGrants(expertId, grants, filterHidden=true) {
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

      // determine experts relationship in this grant
      let relatedBy = g.relatedBy || [];
      if( !Array.isArray(relatedBy) ) relatedBy = [relatedBy];

      let expertsRelationship = {};
      let otherRelationships = [];

      relatedBy.forEach(r => {
        let isExpert = false;
        let relates = r.relates || [];
        if( !Array.isArray(relates) ) relates = [relates];

        relates.forEach(relate => {
          if( typeof relate === 'string' && relate.trim().toLowerCase() === expertId.trim().toLowerCase() ) {
            expertsRelationship = r;
            isExpert = true;
          } else if( relate['@id'] && relate['@id'].includes(expertId) ) {
            expertsRelationship = r;
            isExpert = true;
          }
        });
        if( !isExpert ) otherRelationships.push(r);
      });

      if( filterHidden && !expertsRelationship['is-visible'] ) {
        console.warn('Invalid grant is-visible, should be true', g);
        return;
      }

      g.isVisible = expertsRelationship['is-visible'];
      g.relationshipId = expertsRelationship['@id'];

      // determine pi/copi in otherRelationships
      let contributors = otherRelationships.map(r => {
        let contributorRole = this.getGrantRole(r['@type'] || '');
        if( contributorRole !== 'Co-Principal Investigator' ) return;

        let contributorName = r.relates.filter(relate => relate.name)[0]?.name || '';
        if( contributorName && contributorRole ) {
          return {
            name: contributorName,
            role: contributorRole,
          };
        }
      });

      g.contributors = contributors.filter(c => c); // remove undefined

      // determine role/type using expertsRelationship
      g.role = this.getGrantRole(expertsRelationship['@type'] || '');

      // determine type(s) from all types excluding 'Grant', and split everything after 'Grant_' by uppercase letters with space
      // should just be one type, but just in case
      try {
        if( g['@type'] && !Array.isArray(g['@type']) ) g['@type'] = [g['@type']];
        g.types = (g['@type'] || []).filter(t => t !== 'Grant').map(t => t.split('Grant_')[1].replace(/([A-Z])/g, ' $1').trim());
      } catch(e) {
        console.error('Error parsing grant types', g);
        g.types = ['Grant'];
      }

      // determine awarded-by
      g.awardedBy = g.assignedBy?.name;

      if( Array.isArray(g.name) ) g.name = g.name[0];

      // if grant idenfication number is in the name/title, remove it
      let grantIdentifier = g['@id'].split('grant/').pop();
      if( g.name.includes(grantIdentifier) ) g.name = g.name.replace(grantIdentifier, '');

      return g;
    });

    parsedGrants = parsedGrants.filter(g => g); // remove undefined
    // parsedGrants.sort((a,b) => new Date(b.dateTimeInterval?.end?.dateTime) - new Date(a.dateTimeInterval?.end?.dateTime) || a.name.localeCompare(b.name));
    return parsedGrants;
  }

  /**
   * @method getCookie
   * @description given a cookie name, return the value of the cookie
   *
   * @return {String} cookie value or null
   */
  getCookie(name) {
    let cookieArr = document.cookie.split("; ");

    for(let i = 0; i < cookieArr.length; i++) {
      let cookiePair = cookieArr[i].split("=");

      if(name == cookiePair[0]) {
        return decodeURIComponent(cookiePair[1]);
      }
    }

    // return null if not found
    return null;
  }

  /**
   * @method getExpertApiOptions
   * @description return options for expert api, optionally override options with passed in object
   *
   * @param {Object} options object with api request options
   *
   * @return {Object} options final object
   */
  getExpertApiOptions(options={}) {
    let defaults = {
      ...{
        includeExpert : true,
        includeWorks : true,
        includeGrants : true,
        includeHidden : false,
        includeWorksMisformatted : false,
        includeGrantsMisformatted : false,
        worksPage : 1,
        worksSize : 10,
        worksSort : [
          {
            field : 'issued',
            sort : 'desc',
            type : 'year',
          },
          {
            field : 'title',
            sort : 'asc',
            type : 'string',
          }
        ],
        worksExclude : [],
        grantsPage : 1,
        grantsSize : 5,
        grantsSort : [
          {
            field : 'dateTimeInterval.end.dateTime',
            sort : 'desc',
            type : 'date',
          },
          {
            field : 'name',
            sort : 'asc',
            type : 'string',
          }
        ],
        grantsExclude : [ 'totalAwardAmount' ]
      },
      ...options
    };

    return {
      'is-visible' : !defaults.includeHidden,
      expert : { include : defaults.includeExpert },
      grants : {
        include : defaults.includeGrants,
        page : defaults.grantsPage,
        size : defaults.grantsSize,
        exclude : defaults.grantsExclude,
        includeMisformatted : defaults.includeGrantsMisformatted,
        sort : defaults.grantsSort
      },
      works : {
        include : defaults.includeWorks,
        page : defaults.worksPage,
        size : defaults.worksSize,
        exclude : defaults.worksExclude,
        includeMisformatted : defaults.includeWorksMisformatted,
        sort : defaults.worksSort
      }
    };
  }

  /**
   * @method buildAvailabilityPayload
   * @description return availability label payload for updating cdl
   *
   * @param {Object} openTo object with keys for each type of colab
   * @param {Object} prevOpenTo object with keys for each type of colab currently saved in cdl
   *
   * @return {Object} payload
   */
  buildAvailabilityPayload(openTo={}, prevOpenTo={}) {
    let options = {
      labelsToAddOrEdit: [],
      labelsToRemove: [],
      currentLabels: []
    };
    let labels = {
      collab : 'Collaborative projects',
      community : 'Community partnerships',
      industry : 'Industry Projects',
      media : 'Media enquiries'
    };

    if( openTo.collabProjects ) options.currentLabels.push(labels.collab);
    if( openTo.commPartner ) options.currentLabels.push(labels.community);
    if( openTo.industProjects ) options.currentLabels.push(labels.industry);
    if( openTo.mediaInterviews ) options.currentLabels.push(labels.media);

    if( openTo.collabProjects !== prevOpenTo.collabProjects ) {
      if( openTo.collabProjects ) {
        options.labelsToAddOrEdit.push({ value: labels.collab, percentage: null });
      } else {
        options.labelsToRemove.push(labels.collab);
      }
    }

    if( openTo.commPartner !== prevOpenTo.commPartner ) {
      if( openTo.commPartner ) {
        options.labelsToAddOrEdit.push({ value: labels.community, percentage: null });
      } else {
        options.labelsToRemove.push(labels.community);
      }
    }

    if( openTo.industProjects !== prevOpenTo.industProjects ) {
      if( openTo.industProjects ) {
        options.labelsToAddOrEdit.push({ value: labels.industry, percentage: null });
      } else {
        options.labelsToRemove.push(labels.industry);
      }
    }

    if( openTo.mediaInterviews !== prevOpenTo.mediaInterviews ) {
      if( openTo.mediaInterviews ) {
        options.labelsToAddOrEdit.push({ value: labels.media, percentage: null });
      } else {
        options.labelsToRemove.push(labels.media);
      }
    }

    return options;
  }

  /**
   * @method buildSearchAvailability
   * @description return availability array for search api
   *
   * @param {Object} openTo object with keys for each type of availability
   *
   * @return {Array} hasAvailability
   */
  buildSearchAvailability(openTo) {
    let availability = [];

    let arks = {
      collab : 'ark:/87287/d7mh2m/keyword/c-ucd-avail/Collaborative%20projects',
      community : 'ark:/87287/d7mh2m/keyword/c-ucd-avail/Community%20partnerships',
      industry : 'ark:/87287/d7mh2m/keyword/c-ucd-avail/Industry%20Projects',
      media : 'ark:/87287/d7mh2m/keyword/c-ucd-avail/Media%20enquiries'
    };

    if( openTo.collabProjects ) availability.push(arks.collab);
    if( openTo.commPartner ) availability.push(arks.community);
    if( openTo.industProjects ) availability.push(arks.industry);
    if( openTo.mediaInterviews ) availability.push(arks.media);

    return availability;
  }

}

module.exports = new Utils();
