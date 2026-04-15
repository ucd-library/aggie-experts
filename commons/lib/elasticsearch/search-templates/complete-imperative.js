/**
 * @module complete-imperative
 * @description Imperative JavaScript implementation of the complete Elasticsearch
 * search query. Equivalent to complete.mustache but builds the query body
 * programmatically using denormalized combined text fields on @graph nodes:
 *   - search_name       (family/given/middle names, author names)
 *   - search_title      (title, job title)
 *   - search_identifiers (IDs, DOIs, ORCIDs, emails, identifiers)
 *   - search_description (abstract, overview, org units, journal, publisher)
 *
 * These fields are populated by the webapp transform pipeline. This module
 * is registered in search-templates/index.js and selected at runtime via
 * config.elasticsearch.searchImplementation = 'imperative'.
 */

/**
 * @constant COMBINED_FIELDS
 * @description Denormalized combined text fields with boosts for nested @graph queries.
 * Boost values mirror the field-group priorities from the mustache template.
 */
const COMBINED_FIELDS = [
  '@graph.search_name^20',
  '@graph.search_title^10',
  '@graph.search_identifiers^10',
  '@graph.search_description^5'
];

/**
 * @function _nestedVisibilityFilter
 * @description Build a nested visibility filter accepting nodes that are directly
 * visible or visible through a relatedBy relationship.
 * @returns {Object} Elasticsearch bool filter clause
 */
function _nestedVisibilityFilter() {
  return {
    bool: {
      should: [
        {
          bool: {
            must: [
              { exists: { field: '@graph.is-visible' } },
              { term: { '@graph.is-visible': true } }
            ]
          }
        },
        {
          bool: {
            must: [
              { exists: { field: '@graph.relatedBy.is-visible' } },
              { term: { '@graph.relatedBy.is-visible': true } }
            ]
          }
        }
      ],
      minimum_should_match: 1
    }
  };
}

/**
 * @function _workDateRange
 * @description Build a date range filter for Work nodes using the issued field.
 * @param {String} dateFrom lower bound (yyyy-MM-dd), optional
 * @param {String} dateTo upper bound (yyyy-MM-dd), optional
 * @returns {Object} Elasticsearch bool clause
 */
function _workDateRange(dateFrom, dateTo) {
  const must = [
    { term: { '@graph.@type': 'Work' } },
    { exists: { field: '@graph.issued' } }
  ];
  if (dateFrom && dateTo) {
    must.push({ range: { '@graph.issued': { gte: dateFrom, lte: dateTo } } });
  } else if (dateFrom) {
    must.push({ range: { '@graph.issued': { gte: dateFrom } } });
  } else if (dateTo) {
    must.push({ range: { '@graph.issued': { lte: dateTo } } });
  }
  return { bool: { must } };
}

/**
 * @function _grantDateRange
 * @description Build a date range filter for Grant nodes using dateTimeInterval.
 * Handles grants with both start+end, or only end date.
 * @param {String} dateFrom lower bound (yyyy-MM-dd), optional
 * @param {String} dateTo upper bound (yyyy-MM-dd), optional
 * @returns {Object} Elasticsearch bool clause
 */
function _grantDateRange(dateFrom, dateTo) {
  const startField = '@graph.dateTimeInterval.start.dateTime';
  const endField = '@graph.dateTimeInterval.end.dateTime';

  const bothEndsMust = [
    { exists: { field: startField } },
    { exists: { field: endField } }
  ];
  if (dateFrom && dateTo) {
    bothEndsMust.push({ range: { [startField]: { lte: dateTo } } });
    bothEndsMust.push({ range: { [endField]: { gte: dateFrom } } });
  } else if (dateFrom) {
    bothEndsMust.push({ range: { [endField]: { gte: dateFrom } } });
  } else if (dateTo) {
    bothEndsMust.push({ range: { [startField]: { lte: dateTo } } });
  }

  const endOnlyMust = [
    { exists: { field: endField } },
    { bool: { must_not: [{ exists: { field: startField } }] } }
  ];
  if (dateFrom) {
    endOnlyMust.push({ range: { [endField]: { gte: dateFrom } } });
  }

  return {
    bool: {
      must: [{ term: { '@graph.@type': 'Grant' } }],
      should: [
        { bool: { must: bothEndsMust } },
        { bool: { must: endOnlyMust } }
      ],
      minimum_should_match: 1
    }
  };
}

/**
 * @function _grantDateRangeAgg
 * @description Grant date range filter for the grants_unique_over_range aggregation.
 * Extends _grantDateRange with a third case: grants that have a start date but no end date.
 * @param {String} dateFrom lower bound (yyyy-MM-dd), optional
 * @param {String} dateTo upper bound (yyyy-MM-dd), optional
 * @returns {Object} Elasticsearch bool clause
 */
function _grantDateRangeAgg(dateFrom, dateTo) {
  const startField = '@graph.dateTimeInterval.start.dateTime';
  const endField = '@graph.dateTimeInterval.end.dateTime';

  const bothEndsMust = [
    { exists: { field: startField } },
    { exists: { field: endField } }
  ];
  if (dateFrom && dateTo) {
    bothEndsMust.push({ range: { [startField]: { lte: dateTo } } });
    bothEndsMust.push({ range: { [endField]: { gte: dateFrom } } });
  } else if (dateFrom) {
    bothEndsMust.push({ range: { [endField]: { gte: dateFrom } } });
  } else if (dateTo) {
    bothEndsMust.push({ range: { [startField]: { lte: dateTo } } });
  }

  const startOnlyMust = [
    { exists: { field: startField } },
    { bool: { must_not: [{ exists: { field: endField } }] } }
  ];
  if (dateTo) {
    startOnlyMust.push({ range: { [startField]: { lte: dateTo } } });
  }

  const endOnlyMust = [
    { exists: { field: endField } },
    { bool: { must_not: [{ exists: { field: startField } }] } }
  ];
  if (dateFrom) {
    endOnlyMust.push({ range: { [endField]: { gte: dateFrom } } });
  }

  return {
    bool: {
      should: [
        { bool: { must: bothEndsMust } },
        { bool: { must: startOnlyMust } },
        { bool: { must: endOnlyMust } }
      ],
      minimum_should_match: 1
    }
  };
}

/**
 * @function _dateRangeFilter
 * @description Build a combined date range filter for both Work and Grant nodes.
 * @param {String} dateFrom lower bound (yyyy-MM-dd), optional
 * @param {String} dateTo upper bound (yyyy-MM-dd), optional
 * @returns {Object} Elasticsearch bool should clause
 */
function _dateRangeFilter(dateFrom, dateTo) {
  return {
    bool: {
      should: [
        _workDateRange(dateFrom, dateTo),
        _grantDateRange(dateFrom, dateTo)
      ],
      minimum_should_match: 1
    }
  };
}

/**
 * @function _expertTypeBool
 * @description Build the Expert-type branch of the document type/availability filter.
 * @param {Array} availability availability label filter values, optional
 * @param {Array} expert expert @id filter values, optional
 * @returns {Object} Elasticsearch bool clause
 */
function _expertTypeBool(availability, expert) {
  const must = [{ term: { '@type': 'Expert' } }];
  if (availability) {
    must.push({
      bool: {
        must: [
          { exists: { field: 'hasAvailability.prefLabel' } },
          { terms: { 'hasAvailability.prefLabel': availability } }
        ]
      }
    });
  }
  if (expert) {
    must.push({ terms: { '@id': expert } });
  }
  return { bool: { must } };
}

/**
 * @function _nonExpertTypeBool
 * @description Build the non-Expert-type branch of the document type filter.
 * Optionally restricts to documents whose @graph contains a specific expert @id.
 * @param {Array} expert expert @id filter values, optional
 * @returns {Object} Elasticsearch bool clause
 */
function _nonExpertTypeBool(expert) {
  const clause = {
    bool: {
      must_not: [{ term: { '@type': 'Expert' } }]
    }
  };
  if (expert) {
    clause.bool.must = {
      nested: {
        path: '@graph',
        ignore_unmapped: true,
        query: {
          bool: {
            must: [
              { exists: { field: '@graph.@id' } },
              { terms: { '@graph.@id': expert } }
            ]
          }
        }
      }
    };
  }
  return clause;
}

/**
 * @function _runtimeMappings
 * @description Build runtime mappings for the computed grant active year field.
 * Emits one date value per calendar year the grant was active.
 * @returns {Object} Elasticsearch runtime_mappings definition
 */
function _runtimeMappings() {
  return {
    '@graph.graph_active_year': {
      type: 'date',
      script: {
        source: `boolean hasStart = !doc['@graph.dateTimeInterval.start.dateTime'].empty; boolean hasEnd = !doc['@graph.dateTimeInterval.end.dateTime'].empty; if (!hasStart && !hasEnd) return; Instant startI = hasStart ? doc['@graph.dateTimeInterval.start.dateTime'].value.toInstant() : null; Instant endI = hasEnd ? doc['@graph.dateTimeInterval.end.dateTime'].value.toInstant() : Instant.ofEpochMilli(new Date().getTime()); int ys = hasStart ? ZonedDateTime.ofInstant(startI, ZoneOffset.UTC).getYear() : ZonedDateTime.ofInstant(endI, ZoneOffset.UTC).getYear(); int ye = ZonedDateTime.ofInstant(endI, ZoneOffset.UTC).getYear(); if (!hasStart) { emit(ZonedDateTime.of(ys,1,1,0,0,0,0, ZoneOffset.UTC).toInstant().toEpochMilli()); return; } if (ye < ys) { emit(ZonedDateTime.of(ys,1,1,0,0,0,0, ZoneOffset.UTC).toInstant().toEpochMilli()); return; } for (int y = ys; y <= ye; y++) { emit(ZonedDateTime.of(y,1,1,0,0,0,0, ZoneOffset.UTC).toInstant().toEpochMilli()); }`
      }
    }
  };
}

/**
 * @function _buildAggs
 * @description Build the aggregations section of the query including yearly histograms
 * for works and grants, grants_unique_over_range, and facet term aggregations.
 * @param {String} q query string, optional
 * @param {Array} expert expert IDs filter, optional
 * @param {String} dateFrom date from filter, optional
 * @param {String} dateTo date to filter, optional
 * @param {Boolean} hasDate whether date filtering is active
 * @returns {Object} Elasticsearch aggregations definition
 */
function _buildAggs(q, expert, dateFrom, dateTo, hasDate) {
  const aggVisibility = {
    bool: {
      should: [
        {
          bool: {
            must: [
              { exists: { field: '@graph.is-visible' } },
              { term: { '@graph.is-visible': true } }
            ]
          }
        },
        {
          bool: {
            must: [
              { exists: { field: '@graph.relatedBy.is-visible' } },
              { term: { '@graph.relatedBy.is-visible': true } }
            ]
          }
        }
      ],
      minimum_should_match: 1
    }
  };

  const qClause = q ? {
    simple_query_string: { query: q, fields: COMBINED_FIELDS, default_operator: 'and' }
  } : null;

  const expertNestedFilter = expert ? {
    nested: {
      path: '@graph',
      query: {
        bool: {
          must: [
            { exists: { field: '@graph.@id' } },
            { terms: { '@graph.@id': expert } }
          ]
        }
      }
    }
  } : null;

  // Works yearly histogram
  const worksAggMust = [{ term: { '@type': 'work' } }];
  if (expertNestedFilter) worksAggMust.push(expertNestedFilter);

  const worksNestedMust = [
    { term: { '@graph.@type': 'Work' } },
    { exists: { field: '@graph.issued' } },
    aggVisibility
  ];
  if (qClause) worksNestedMust.push(qClause);

  // Grants yearly histogram
  const grantsAggMust = [{ term: { '@type': 'grant' } }];
  if (expertNestedFilter) grantsAggMust.push(expertNestedFilter);

  const grantsNestedMust = [
    { term: { '@graph.@type': 'Grant' } },
    aggVisibility
  ];
  if (qClause) grantsNestedMust.push(qClause);

  // Grants unique over range
  const grantsUniqueMust = [{ term: { '@graph.@type': 'Grant' } }];
  if (hasDate) grantsUniqueMust.push(_grantDateRangeAgg(dateFrom, dateTo));

  return {
    years: {
      global: {},
      aggs: {
        works: {
          filter: { bool: { must: worksAggMust } },
          aggs: {
            works_nested: {
              nested: { path: '@graph' },
              aggs: {
                filtered: {
                  filter: { bool: { must: worksNestedMust } },
                  aggs: {
                    years: {
                      date_histogram: {
                        field: '@graph.issued',
                        calendar_interval: 'year',
                        min_doc_count: 0,
                        time_zone: 'UTC'
                      },
                      aggs: {
                        unique_works: {
                          cardinality: { field: '@graph.@id', precision_threshold: 40000 }
                        },
                        parent_docs: {
                          reverse_nested: {},
                          aggs: {
                            status: { terms: { field: 'status', size: 10 } },
                            type: { terms: { field: 'type', size: 10 } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        grants: {
          filter: { bool: { must: grantsAggMust } },
          aggs: {
            grants_nested: {
              nested: { path: '@graph' },
              aggs: {
                filtered: {
                  filter: { bool: { must: grantsNestedMust } },
                  aggs: {
                    years: {
                      date_histogram: {
                        field: '@graph.graph_active_year',
                        calendar_interval: 'year',
                        min_doc_count: 0,
                        time_zone: 'UTC'
                      },
                      aggs: {
                        unique_grants: {
                          cardinality: { field: '@graph.@id', precision_threshold: 40000 }
                        },
                        grant_ids: {
                          terms: { field: '@graph.@id', size: 1000 },
                          aggs: {
                            to_parent: {
                              reverse_nested: {},
                              aggs: {
                                status: { terms: { field: 'status', size: 5 } },
                                type: { terms: { field: 'type', size: 5 } }
                              }
                            }
                          }
                        },
                        parent_docs: {
                          reverse_nested: {},
                          aggs: {
                            status: { terms: { field: 'status', size: 10 } },
                            type: { terms: { field: 'type', size: 10 } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    grants_unique_over_range: {
      nested: { path: '@graph' },
      aggs: {
        filtered: {
          filter: { bool: { must: grantsUniqueMust } },
          aggs: {
            unique_ids: { cardinality: { field: '@graph.@id', precision_threshold: 40000 } },
            ids: { terms: { field: '@graph.@id', size: 1000 } }
          }
        }
      }
    },
    '@type': { terms: { field: '@type', size: 20 } },
    availability: { terms: { field: 'hasAvailability.prefLabel', size: 10 } },
    status: { terms: { field: 'status', size: 10 } },
    type: { terms: { field: 'type', size: 10 } }
  };
}

/**
 * @function buildQuery
 * @description Build an Elasticsearch query body from search parameters.
 * Uses the denormalized combined text fields (search_name, search_title,
 * search_identifiers, search_description) on nested @graph nodes instead of
 * the many individual field paths used by the mustache template.
 *
 * @param {Object} params search parameters
 * @param {String} [params.q] query string
 * @param {Number} [params.min_nested_score=10.0] minimum score threshold for nested function_score
 * @param {Number} [params.min_score=5.0] minimum overall document score
 * @param {Number} [params.from=0] pagination offset
 * @param {Number} [params.size=10] page size
 * @param {Number} [params.inner_hits_size=500] maximum inner hits per parent document
 * @param {Array}  [params.availability] hasAvailability.prefLabel filter values
 * @param {Array}  [params.expert] expert @id filter values
 * @param {Array}  [params['@type']] document @type filter, defaults to ['expert','grant','work']
 * @param {Array}  [params.status] status field filter values
 * @param {Array}  [params.type] type field filter values
 * @param {String} [params.dateFrom] start date bound (yyyy-MM-dd)
 * @param {String} [params.dateTo] end date bound (yyyy-MM-dd)
 * @param {Boolean}[params.hasDate] true when date filtering is active
 * @returns {Object} Elasticsearch query body ready for client.search()
 */
function buildQuery(params) {
  const q = params.q;
  const min_nested_score = params.min_nested_score ?? 10.0;
  const min_score = params.min_score ?? 5.0;
  const from = params.from ?? 0;
  const size = params.size ?? 10;
  const inner_hits_size = params.inner_hits_size ?? 500;
  const availability = params.availability;
  const expert = params.expert;
  const atType = params['@type'] || ['expert', 'grant', 'work'];
  const status = params.status;
  const type = params.type;
  const dateFrom = params.dateFrom;
  const dateTo = params.dateTo;
  const hasDate = params.hasDate;

  // Root document visibility + type/availability/expert filter
  const filterMust = [
    {
      bool: {
        must: [
          { exists: { field: 'is-visible' } },
          { term: { 'is-visible': true } }
        ]
      }
    },
    {
      bool: {
        should: [
          _expertTypeBool(availability, expert),
          _nonExpertTypeBool(expert)
        ],
        minimum_should_match: 1
      }
    }
  ];

  const query = {
    bool: {
      filter: { bool: { must: filterMust } }
    }
  };

  if (q) {
    const nestedFilters = [_nestedVisibilityFilter()];
    if (hasDate) nestedFilters.push(_dateRangeFilter(dateFrom, dateTo));

    query.bool.must = {
      nested: {
        path: '@graph',
        ignore_unmapped: true,
        query: {
          function_score: {
            query: {
              bool: {
                must: [{
                  simple_query_string: {
                    query: q,
                    fields: COMBINED_FIELDS,
                    default_operator: 'and'
                  }
                }],
                filter: nestedFilters
              }
            },
            min_score: min_nested_score,
            boost_mode: 'replace'
          }
        },
        inner_hits: {
          size: inner_hits_size,
          _source: [
            '@graph.@id', '@graph.@type', '@graph.name',
            '@graph.volume', '@graph.issue', '@graph.relatedBy', '_score'
          ]
        },
        score_mode: 'sum'
      }
    };
  }

  // Post filter controls @type, status, and type facets without affecting aggregations
  const postFilterMust = [{ terms: { '@type': atType } }];
  if (status) {
    postFilterMust.push({ exists: { field: 'status' } });
    postFilterMust.push({ terms: { status } });
  }
  if (type) {
    postFilterMust.push({ exists: { field: 'type' } });
    postFilterMust.push({ terms: { type } });
  }

  return {
    track_total_hits: true,
    query,
    post_filter: { bool: { must: postFilterMust } },
    aggs: _buildAggs(q, expert, dateFrom, dateTo, hasDate),
    _source: [
      '@id', '@type', 'name', 'contactInfo', 'title', 'issued', 'container-title',
      'type', 'DOI', 'modified-date', 'status', 'author', 'volume', 'issue', 'page',
      'abstract', 'sponsorAwardId', 'assignedBy', 'dateTimeInterval', 'relatedBy', '_score'
    ],
    sort: ['_score', '@type', 'name.kw'],
    from,
    size,
    min_score,
    runtime_mappings: _runtimeMappings()
  };
}

const template = {
  id: 'complete-imperative',
  buildQuery
};

export default template;
