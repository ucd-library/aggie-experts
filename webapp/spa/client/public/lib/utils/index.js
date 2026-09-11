const SchemaModel = require('../models/SchemaModel');

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
   * @method formatCount
   * @description format a numeric result count for display. Numbers with 5 or more digits
   * are grouped with commas for readability (e.g. 10000 -> "10,000"); shorter numbers are
   * left as-is. When `capped` is true the value is a lower bound (the true total exceeds what
   * we retrieve) and a trailing "+" is appended (e.g. "10,000+").
   * @param {Number} n the count
   * @param {Boolean} [capped=false] whether the count is a capped lower bound
   * @return {String} formatted count
   */
  formatCount(n, capped = false) {
    if (n == null || isNaN(n)) return '';
    const num = Number(n);
    const formatted = Math.abs(num) >= 10000 ? num.toLocaleString('en-US') : String(num);
    return capped ? `${formatted}+` : formatted;
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
   * @param {{ dept: string, deptCodesIncluded: string, deptCodesExcluded: string }} [deptParams] serialized dept filter params
   */
  buildSearchQuery(searchTerm, page=1, size=25, availability=[], atType, status, type, expertId, dateFrom, dateTo, deptParams={}) {
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
    if( deptParams?.dept ) searchQuery += `&dept=${encodeURIComponent(deptParams.dept)}`;
    if( deptParams?.deptCodesIncluded ) searchQuery += `&deptCodesIncluded=${encodeURIComponent(deptParams.deptCodesIncluded)}`;
    if( deptParams?.deptCodesExcluded ) searchQuery += `&deptCodesExcluded=${encodeURIComponent(deptParams.deptCodesExcluded)}`;

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

  /**
   * localStorage key used by the failed-update tracking methods.
   */
  FAILED_UPDATE_STORAGE_KEY = 'ae-failed-updates';

  /**
   * Maps a failed-update `type` to the ES index prefix that holds its data,
   * used to look up which index is currently serving reads for that type.
   */
  FAILED_UPDATE_TYPE_INDEX_PREFIX = {
    work: 'works',
    grant: 'grants',
    availability: 'experts'
  };

  /**
   * In-memory cache of public-index lookups, keyed by index prefix, to avoid
   * re-fetching on every trackFailedUpdate()/getFailedUpdates() call.
   */
  _publicIndexNameCache = {};

  /**
   * How long a cached public-index lookup is considered fresh, in ms.
   */
  PUBLIC_INDEX_NAME_CACHE_MS = 60000;

  /**
   * Success labels for CDL-only failures (blue banner): action succeeded in ES but not CDL.
   * Keyed by action slug.
   */
  FAILED_UPDATE_SUCCESS_LABELS = {
    'hide-work':           'Work hidden',
    'show-work':           'Work set to visible',
    'add-highlight':       'Work added to highlights',
    'remove-highlight':    'Work removed from highlights',
    'hide-grant':          'Grant hidden',
    'show-grant':          'Grant set to visible',
    'update-availability': 'Availability updated'
  };

  /**
   * Short action descriptions without type prefix, used as list item subtext
   * on the app-expert page where the item name provides type context.
   * Keyed by action slug.
   */
  FAILED_UPDATE_SHORT_LABELS = {
    'hide-work':           'could not be hidden.',
    'show-work':           'could not be set to visible.',
    'add-highlight':       'could not be added to highlights.',
    'remove-highlight':    'could not be removed from highlights.',
    'hide-grant':          'could not be hidden.',
    'show-grant':          'could not be set to visible.',
    'update-availability': 'could not be updated.'
  };

  /**
   * Error labels for ES failures (red banner).
   * Keyed by action slug.
   */
  FAILED_UPDATE_ERROR_LABELS = {
    'hide-work':           'Work could not be hidden',
    'show-work':           'Work could not be set to visible',
    'add-highlight':       'Work could not be added to highlights',
    'remove-highlight':    'Work could not be removed from highlights',
    'hide-grant':          'Grant could not be hidden',
    'show-grant':          'Grant could not be set to visible',
    'update-availability': 'Availability could not be updated'
  };

  /**
   * @method getPublicIndexName
   * @description return the ES index currently aliased to `public` for the given type,
   * ie the index actually serving reads. Used to detect when a weekly reharvest (or a
   * manual admin publish) has promoted a newer index, so partial-update banners tied
   * to the older index can be dropped. Results are cached briefly to avoid re-fetching
   * on every trackFailedUpdate()/getFailedUpdates() call.
   *
   * @param {String} indexPrefix - 'experts' | 'works' | 'grants'
   *
   * @returns {Promise<String|null>} current index name, or null if the lookup failed
   */
  async getPublicIndexName(indexPrefix) {
    if( !indexPrefix ) return null;

    const cached = this._publicIndexNameCache[indexPrefix];
    if( cached && (Date.now() - cached.timestamp) < this.PUBLIC_INDEX_NAME_CACHE_MS ) {
      return cached.indexName;
    }

    try {
      const res = await SchemaModel.getPublicIndex(indexPrefix);
      const indexName = res?.body?.indexName || null;
      this._publicIndexNameCache[indexPrefix] = { indexName, timestamp: Date.now() };
      return indexName;
    } catch(e) {
      return null;
    }
  }

  /**
   * @method _readFailedUpdatesRaw
   * @description read tracked failed-update entries from localStorage with no pruning.
   *
   * @returns {Array}
   */
  _readFailedUpdatesRaw() {
    try {
      const raw = localStorage.getItem(this.FAILED_UPDATE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  }

  /**
   * @method _writeFailedUpdatesRaw
   * @description persist tracked failed-update entries to localStorage.
   *
   * @param {Array} updates
   */
  _writeFailedUpdatesRaw(updates) {
    try {
      localStorage.setItem(this.FAILED_UPDATE_STORAGE_KEY, JSON.stringify(updates));
    } catch(e) {}
  }

  /**
   * @method trackFailedUpdate
   * @description persist a failed dagster update step to localStorage so that a
   * dismissible banner can be shown later. Tracks CDL and ES failures separately.
   * No-ops when neither step type failed. Info-only (blue banner) entries also record
   * the index currently serving reads, so getFailedUpdates() can drop them once a
   * reharvest promotes a newer index and the CDL/ES mismatch they represent no longer
   * applies.
   *
   * @param {String} expertId
   * @param {Object} opts
   * @param {String} opts.type - 'work' | 'grant' | 'availability'
   * @param {String} opts.name - display name of the item (work title, grant name, etc.)
   * @param {String} opts.action - action slug from FAILED_UPDATE_ACTIONS
   * @param {Array} opts.stepStats - stepStats array from the dagster run response
   */
  async trackFailedUpdate(expertId, opts = {}) {
    const { type, name = '', action, stepStats = [] } = opts;
    const cdlFailed = stepStats.some(s => s.stepKey?.endsWith('_cdl') && s.status === 'FAILURE');
    const esFailed  = stepStats.some(s => s.stepKey?.endsWith('_es')  && s.status === 'FAILURE');
    if( !cdlFailed && !esFailed ) return;
    console.warn(`[failed-update] expertId=${expertId} type=${type} action=${action} name="${name}" cdlFailed=${cdlFailed} esFailed=${esFailed}`);

    const indexName = (!cdlFailed && esFailed)
      ? await this.getPublicIndexName(this.FAILED_UPDATE_TYPE_INDEX_PREFIX[type])
      : null;

    const updates = this._readFailedUpdatesRaw().filter(u =>
      !(u.expertId === expertId && u.type === type && u.name === name)
    );
    updates.push({ expertId, type, name, action, cdlFailed, esFailed, indexName, timestamp: Date.now() });
    this._writeFailedUpdatesRaw(updates);
  }

  /**
   * @method getFailedUpdates
   * @description return tracked failed updates, optionally filtered by expertId. Before
   * returning, drops any info-only (blue banner) entry whose recorded index is no longer
   * the one aliased to `public` - meaning a reharvest/publish has since happened and the
   * update it was tracking should now be reflected in search. Error (red banner) entries
   * are left alone, since a CDL write failure isn't resolved by a reharvest.
   *
   * @param {String} [expertId]
   *
   * @returns {Promise<Array>}
   */
  async getFailedUpdates(expertId) {
    const all = this._readFailedUpdatesRaw();

    const infoEntries = all.filter(u => !u.cdlFailed && u.esFailed && u.indexName);
    const prefixes = [...new Set(infoEntries.map(u => this.FAILED_UPDATE_TYPE_INDEX_PREFIX[u.type]))];
    const currentIndexByPrefix = {};
    await Promise.all(prefixes.map(async prefix => {
      currentIndexByPrefix[prefix] = await this.getPublicIndexName(prefix);
    }));

    const stale = new Set(infoEntries.filter(u => {
      const currentIndexName = currentIndexByPrefix[this.FAILED_UPDATE_TYPE_INDEX_PREFIX[u.type]];
      return currentIndexName && currentIndexName !== u.indexName;
    }));

    const remaining = all.filter(u => !stale.has(u));
    if( remaining.length !== all.length ) this._writeFailedUpdatesRaw(remaining);

    return expertId ? remaining.filter(u => u.expertId === expertId) : remaining;
  }

  /**
   * @method dismissFailedUpdate
   * @description remove a tracked failed update entry from localStorage.
   *
   * @param {String} expertId
   * @param {Object} opts
   * @param {String} opts.type
   * @param {String} opts.name
   * @param {String} opts.action
   */
  dismissFailedUpdate(expertId, opts = {}) {
    const updates = this._readFailedUpdatesRaw().filter(u => {
      if( u.expertId !== expertId ) return true;
      if( opts.type   && u.type   !== opts.type   ) return true;
      if( opts.name   && u.name   !== opts.name   ) return true;
      if( opts.action && u.action !== opts.action ) return true;
      return false;
    });
    this._writeFailedUpdatesRaw(updates);
  }

  /**
   * @method markFailedUpdateForced
   * @description flag a tracked failed-update entry as "forced" once the user has
   * clicked "contact us" and the CDL-bypass force job has succeeded. The entry is kept
   * (rather than dismissed) since CDL/Elements still hasn't been reconciled - the banner
   * shows different copy for forced entries explaining that the change is live but CDL
   * will need to be manually reconciled once the service is restored.
   *
   * @param {String} expertId
   * @param {Object} opts
   * @param {String} opts.type
   * @param {String} opts.name
   */
  markFailedUpdateForced(expertId, opts = {}) {
    const updates = this._readFailedUpdatesRaw().map(u => {
      if( u.expertId === expertId && u.type === opts.type && u.name === opts.name ) {
        return { ...u, forced: true };
      }
      return u;
    });
    this._writeFailedUpdatesRaw(updates);
  }

  /**
   * @method hasCdlStepFailed
   * @description check whether any CDL step in a dagster run's stepStats failed.
   * Only CDL failures warrant showing the "Update Failed" contact-us modal — ES/Postgres
   * failures are transient and do not require user action.
   *
   * @param {Array} stepStats - array of stepStat objects from the dagster run response
   * @returns {Boolean}
   */
  hasCdlStepFailed(stepStats = []) {
    return stepStats.some(s => s.stepKey?.endsWith('_cdl') && s.status === 'FAILURE');
  }

  /**
   * @method pollAdminUpdateJobs
   * @description poll dagster job status for an admin update job until it reaches a
   * terminal state. Logs progress to the console on each tick. When the job is complete
   * the optional onComplete callback is invoked with the final status.
   *
   * @param {Object} res - BaseService response from a DagsterModel admin update call.
   *   Expected shape: res.body = { data: { launchRun: { run: { runId } } } }
   * @param {Function} getRunStatus - async fn(runId) returning a BaseService response.
   *   Expected shape: res.body = { data: { runOrError: { status } } }
   * @param {Object} opts
   * @param {String} opts.label - label used in console log messages
   * @param {Number} opts.interval - polling interval in ms, default 5000
   * @param {Function} opts.onComplete - callback invoked with the terminal status string
   *   once the job reaches a terminal state
   *
   * @returns {Number|null} setInterval id, or null if no run ID was found in the response
   */
  pollAdminUpdateJobs(res, getRunStatus, opts = {}) {
    const label = opts.label || 'admin update';
    const interval = opts.interval || 5000;
    const terminalStates = ['SUCCESS', 'FAILURE', 'CANCELED'];

    const runId = res?.body?.data?.launchRun?.run?.runId;

    if (!runId) {
      console.warn(`[dagster:${label}] no run ID found in response`, res?.body);
      return null;
    }

    console.log(`[dagster:${label}] job launched - runId: ${runId}`);

    let lastStatus = null;

    const intervalId = setInterval(async () => {
      const statusRes = await getRunStatus(runId);
      const runOrError = statusRes?.body?.data?.runOrError;
      const status = runOrError?.status;

      if (status && status !== lastStatus) {
        lastStatus = status;
        console.log(`[dagster:${label}] status: ${status}`);
      }

      if (terminalStates.includes(status)) {
        clearInterval(intervalId);
        console.log(`[dagster:${label}] job complete - status: ${status}`);
        if (typeof opts.onComplete === 'function') {
          opts.onComplete(status, runOrError?.stepStats || []);
        }
      }
    }, interval);

    return intervalId;
  }

}

module.exports = new Utils();
