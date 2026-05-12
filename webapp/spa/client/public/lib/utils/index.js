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

  /*
  * @method formatDate
  * @description given a date object, return a formatted date string
  * @param {Object} dateObj object with year, month, day
  * @return {String} formatted date string
  */
  formatDate(dateObj) {
    if (!dateObj) return '';

    const options = {};
    if (dateObj.year) options.year = 'numeric';
    if (dateObj.month) options.month = 'long';
    if (dateObj.day) options.day = 'numeric';

    return new Date(dateObj.year, dateObj.month ? dateObj.month - 1 : 0, dateObj.day || 1).toLocaleDateString('en-US', options);
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

  formatCitation(cite) {
    // remove '(n.d.).' and '(N.d.).', including with trailing spaces
    return cite.apa?.replace(/\([nN]\.d\.\)\.\s*/g, '') || 'Cannot format citation. Contact your <a href="mailto:experts@ucdavis.edu">Aggie Experts administrator.</a>';
  }

  /**
   * @method getGrantRole
   * @description given a relationship with a GrantType vivo role @type, returns the role to display in AE and the relationship ID (if exists).
   * defaults to Researcher if no other role is found
   *
   * @param {Object | Array} roles relationship object with @type or array of @type
   *
   * @return {Object} readable roles and relationship id (if exists)
   */
  getGrantRole(roles) {
    let readableRole = 'Researcher';
    let relationshipId = null;

    if( !Array.isArray(roles) ) roles = [roles];

    const normalizeType = (type) => Array.isArray(type) ? type : [type];

    try {
      let piRole = roles.find(r => normalizeType(r['@type']).includes('PrincipalInvestigatorRole'));
      let leaderRole = roles.find(r => normalizeType(r['@type']).includes('LeaderRole'));
      let copiRole = roles.find(r => normalizeType(r['@type']).includes('CoPrincipalInvestigatorRole'));
      let researchRole = roles.find(r => normalizeType(r['@type']).includes('ResearcherRole'));

      if( piRole ) {
        readableRole = 'Principal Investigator';
        relationshipId = piRole['@id'];
      } else if( leaderRole ) {
        readableRole = 'Leader';
        relationshipId = leaderRole['@id'];
      } else if( copiRole ) {
        readableRole = 'Co-Principal Investigator';
        relationshipId = copiRole['@id'];
      } else if( researchRole ) {
        relationshipId = researchRole['@id'];
      }
    } catch(e) {
      console.error('Error parsing grant roles', roles);
    }

    return { relationshipId, role: readableRole };
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

      let expertsRelationships = [];
      let otherRelationships = [];

      relatedBy.forEach(r => {
        let isExpert = false;
        let relates = r.relates || [];
        if( !Array.isArray(relates) ) relates = [relates];

        relates.forEach(relate => {
          if( typeof relate === 'string' && relate.trim().toLowerCase() === expertId.trim().toLowerCase() ) {
            expertsRelationships.push(r);
            isExpert = true;
          } else if( relate['@id'] && relate['@id'].includes(expertId) ) {
            expertsRelationships.push(r);
            isExpert = true;
          }
        });
        // Skip dangling {@id} stubs left over from harvest-time #roleof_ drops
        // — they have no @type and shouldn't render as contributors.
        if( !isExpert && r['@type'] ) otherRelationships.push(r);
      });

      if( filterHidden && !expertsRelationships.some(r => r['is-visible']) ) {
        console.warn('Invalid grant is-visible, should be true', g);
        return;
      }

      g.isVisible = expertsRelationships.some(r => r['is-visible']);
      // g.relationshipId = expertsRelationship['@id'];

      // determine pi/copi in otherRelationships, normalize and dedupe names
      const contributors = [];
      const seenContributors = new Set();
      otherRelationships.forEach((r) => {
        let { role: contributorRole } = this.getGrantRole(r);
        if( !['Principal Investigator', 'Co-Principal Investigator'].includes(contributorRole) ) return;

        let contributorName = r.name || '';
        if( Array.isArray(contributorName) ) contributorName = contributorName[0] || '';
        contributorName = contributorName.replace(/\s*CoPI:\s*/gi, '');
        contributorName = contributorName.replace(/\s*PI:\s*/gi, '');
        contributorName = contributorName.trim();

        const normalizedName = this.getNormalizedContributor(contributorName);
        if( !normalizedName.lastFirst && !normalizedName.nameParts.length ) return;
        if( this.hasSeenContributor(seenContributors, normalizedName) ) return;

        this.markSeenContributor(seenContributors, normalizedName);
        contributors.push({
          name: contributorName,
          role: contributorRole,
        });
      });

      g.contributors = contributors;

      // determine role/type using expertsRelationship
      ({ role: g.role, relationshipId: g.relationshipId } = this.getGrantRole(expertsRelationships));

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
      g.name = g.name?.split('§')?.shift()?.trim();
      if( g.name.includes(grantIdentifier) ) g.name = g.name.replace(grantIdentifier, '');

      return g;
    });

    parsedGrants = parsedGrants.filter(g => g); // remove undefined
    // parsedGrants.sort((a,b) => new Date(b.dateTimeInterval?.end?.dateTime) - new Date(a.dateTimeInterval?.end?.dateTime) || a.name.localeCompare(b.name));
    return parsedGrants;
  }

  /**
   * @method getNormalizedContributor
   * @description given a contributor name, return an object with normalized name formats for matching contributors across grants with varying name formats
   *
   * @param {String} rawName contributor name to normalize, typically from grant relationships
   */
  getNormalizedContributor(rawName) {
    if( !rawName || typeof rawName !== 'string' ) {
      return { lastFirst: '', nameParts: [] };
    }

    let cleaned = rawName
      .replace(/\s*CoPI:\s*/gi, '')
      .replace(/\s*PI:\s*/gi, '')
      .trim();
    if( !cleaned ) {
      return { lastFirst: '', nameParts: [] };
    }

    const nameParts = cleaned
      .toLowerCase()
      .split(/[\s,]+/)
      .map(part => part.trim())
      .filter(part => part.length > 1)
      .sort();

    const parts = cleaned.split(',');
    if( parts.length < 2 ) {
      return {
        lastFirst: cleaned.toLowerCase().replace(/\s+/g, ' '),
        nameParts
      };
    }

    const last = (parts.shift() || '').trim().toLowerCase();
    const givenAndMiddle = parts.join(',').trim();
    const first = (givenAndMiddle.split(/\s+/)[0] || '').trim().toLowerCase();

    return {
      lastFirst: `${last}, ${first}`,
      nameParts
    };
  }

  hasSeenContributor(seenSet, normalized) {
    if( !normalized.lastFirst && !normalized.nameParts.length ) return true;

    // lastFirst match catches middle initial variants
    if( normalized.lastFirst && seenSet.has(`lf:${normalized.lastFirst}`) ) return true;

    // nameParts match catches swapped token ordering
    const partsKey = normalized.nameParts.join('|');
    if( partsKey && seenSet.has(`np:${partsKey}`) ) return true;

    return false;
  }

  markSeenContributor(seenSet, normalized) {
    if( normalized.lastFirst ) seenSet.add(`lf:${normalized.lastFirst}`);
    if( normalized.nameParts.length ) seenSet.add(`np:${normalized.nameParts.join('|')}`);
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
        favouriteWorksFirst : false,
        favouritesPlusFirstPageWorks : false,
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
        sort : defaults.worksSort,
        favouriteWorksFirst : defaults.favouriteWorksFirst,
        favouritesPlusFirstPageWorks : defaults.favouritesPlusFirstPageWorks
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
   * @return {Array} availability
   */
  buildSearchAvailability(openTo) {
    let availability = [];

    let arks = {
      collab : 'Collaborative projects',
      community : 'Community partnerships',
      industry : 'Industry Projects',
      media : 'Media enquiries'
    };

    if( openTo.collabProjects ) availability.push(arks.collab);
    if( openTo.commPartner ) availability.push(arks.community);
    if( openTo.industProjects ) availability.push(arks.industry);
    if( openTo.mediaInterviews ) availability.push(arks.media);

    return availability;
  }

  /**
   * @method buildSearchQuery
   * @description return search query string for search api
   *
   * @param {String} searchTerm search term
   * @param {Number} page page number, defaults to 1
   * @param {Number} size number of results per page, defaults to 25
   * @param {Array} availability array of availability filters
   * @param {String} atType type of search, ie 'grant', 'expert'. if none set, returns all results
   * @param {String} status status of search, ie 'active', 'completed'. if none set, returns all results
   * @param {String} type citation type, ie 'book', 'journal'
   * @param {String} expertId expertId to filter grants/works to
   * @param {String} dateFrom start for date filtering
   * @param {String} dateTo end for date filtering
   */
  buildSearchQuery(searchTerm, page=1, size=25, availability=[], atType, status, type, expertId, dateFrom, dateTo) {
    let searchQuery = `q=${searchTerm}&page=${page}&size=${size}`;

    if( availability.length ) searchQuery += `&availability=${encodeURIComponent(availability.join(','))}`;

    // If no @type filter is provided, default to all result types.
    // This matches the production app behavior where params['@type'] includes
    // expert, grant, and work (instead of the API defaulting to expert-only).
    if( atType ) {
      searchQuery += `&${encodeURIComponent('@type')}=${atType}`;
    } else {
      searchQuery += `&${encodeURIComponent('@type')}=expert,grant,work`;
    }

    if( status ) searchQuery += `&status=${status}`;
    if( type ) searchQuery += `&type=${type}`;
    if( expertId ) searchQuery += `&expert=${encodeURIComponent(expertId)}`;
    if( dateFrom ) searchQuery += `&dateFrom=${dateFrom}`;
    if( dateTo ) searchQuery += `&dateTo=${dateTo}`;

    return searchQuery;
  }

  /**
   * @method filterOutStopWords
   * @description return non-stop words from a search term
   * @param {String} phrase term to parse
   */
  filterOutStopWords(phrase='') {
    let stopWords = [ 'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by',
      'for', 'if', 'in', 'into', 'is', 'it',
      'no', 'not', 'of', 'on', 'or', 'such',
      'that', 'the', 'their', 'then', 'there', 'these',
      'they', 'this', 'to', 'was', 'will', 'with'];

    let words = phrase.trim().split(/\s+/);
    return words.filter(word => word && !stopWords.includes(word.toLowerCase()));
  }

  /**
   * @method formatDagsterTime
   * @description given a dagster timestamp, return a formatted date string
   * @param {Number} endTime dagster timestamp in seconds
   * @return {String} formatted date string
  */
  formatDagsterTime(endTime) {
    if (!endTime) return '';

    // convert seconds to milliseconds
    const date = new Date(endTime * 1000);

    // format: 'Mon XX, 20XX, X:XXpm'
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

}

module.exports = new Utils();
