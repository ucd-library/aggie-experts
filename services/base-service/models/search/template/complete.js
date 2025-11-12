template = {
  id: "complete",
  script: {
    "lang": "mustache",
    "source": `{
      "track_total_hits": true,
      "query": {
        "bool": {
          "filter": {
            "bool": {
              "must": [
                {
                  "bool": {
                    "must": [
                      { "exists": { "field": "is-visible" }},
                      { "term": { "is-visible": true } }
                    ]
                  }
                },
                {
                  "bool": {
                    "should": [
                      {
                        "bool": {
                          "must": [
                            { "term": { "@type": "Expert" } }
                            {{#availability}}
                            ,{
                              "bool": {
                                "must": [
                                  { "exists": { "field": "hasAvailability.prefLabel" } },
                                  { "terms": { "hasAvailability.prefLabel": {{#toJson}}availability{{/toJson}} } }
                                ]
                                "minimum_should_match": 1
                            }
                            {{/availability}}
                            {{#hasDate}}
                            ,{
                              "range": {
                                "@graph.issued": {
                                  {{#dateFrom}}"gte": "{{dateFrom}}"{{/dateFrom}}{{#dateTo}}{{#dateFrom}},{{/dateFrom}}"lte": "{{dateTo}}"{{/dateTo}}
                                }
                              }
                            }
                            {{/hasDate}}
                            {{#expert}}
                            ,{ "terms": { "@id": {{#toJson}}expert{{/toJson}} } }
                            {{/expert}}
                          ]
                        }
                      },
                      {
                        "bool": {
                          "must_not": [ { "term": { "@type": "Expert" } } ]
                          {{#expert}}
                          ,"must": {
                            "nested": {
                              "path": "@graph",
                              "ignore_unmapped": true,
                              "query": {
                                "bool": {
                                  "must": [
                                    { "exists": { "field": "@graph.@id" } },
                                    { "terms": { "@graph.@id": {{#toJson}}expert{{/toJson}} } }
                                  ]
                                }
                              }
                            }
                          }
                          {{/expert}}
                        }
                      }
                    ],
                    "minimum_should_match": 1
                  }
                }
                {{#status}}
                ,{
                  "bool": {
                    "must": [
                      { "exists": { "field": "status" } },
                      { "terms": { "status": [{{#status}}"{{.}}",{{/status}}"none"] } }
                    ]
                  }
                }
                {{/status}}
                {{#type}}
                ,{
                  "bool": {
                    "must": [
                      { "exists": { "field": "type" } },
                      { "terms": { "type": [{{#type}}"{{.}}",{{/type}}"none"] } }
                    ]
                  }
                }
                {{/type}}
              ]
            }
          }
          {{#q}}
          ,"must": {
            "nested": {
              "path": "@graph",
              "ignore_unmapped": true,
              "query": {
                "function_score": {
                  "query": {
                    "bool": {
                      "must": [
                        {
                          "simple_query_string": {
                            "query": "{{q}}",
                            "fields": [
                              "@graph.@id^10",
                              "@graph.relates^2",
                              "@graph.DOI^10",
                              "@graph.abstract^5",
                              "@graph.contactInfo.hasEmail^10",
                              "@graph.contactInfo.hasName.family^20",
                              "@graph.contactInfo.hasName.given^5",
                              "@graph.contactInfo.hasName.middle^5",
                              "@graph.contactInfo.hasTitle.name^5",
                              "@graph.contactInfo.hasURL.name^5",
                              "@graph.contactInfo.hasOrganizationalUnit.name^5",
                              "@graph.name^10",
                              "@graph.orcidId^10",
                              "@graph.overview^5",
                              "@graph.identifier^10",
                              "@graph.container-title^5",
                              "@graph.publisher^5",
                              "@graph.title^10",
                              "@graph.author.family^10",
                              "@graph.author.given^5",
                              "@graph.relatedBy.relates.name^5"
                            ],
                            "default_operator": "and"
                          }
                        }
                      ],
                      "filter": [
                        {
                          "bool": {
                            "should": [
                              {
                                "bool": {
                                  "must": [
                                    { "exists": { "field": "@graph.is-visible" }},
                                    { "term": { "@graph.is-visible": true }}
                                  ]
                                }
                              },
                              {
                                "bool": {
                                  "must": [
                                    { "exists": { "field": "@graph.relatedBy.is-visible" }},
                                    { "term": { "@graph.relatedBy.is-visible": true }}
                                  ]
                                }
                              }
                            ],
                            "minimum_should_match": 1
                          }
                        }
                        {{#hasDate}}
                        ,{
                          "bool": {
                            "should": [
                              {
                                "bool": {
                                  "must": [
                                    { "term": { "@graph.@type": "Work" } },
                                    { "exists": { "field": "@graph.issued" } }
                                    {{#dateFrom}}{{#dateTo}}
                                    ,{ "range": { "@graph.issued": { "gte": "{{dateFrom}}", "lte": "{{dateTo}}" } } }
                                    {{/dateTo}}{{/dateFrom}}
                                    {{#dateFrom}}{{^dateTo}}
                                    ,{ "range": { "@graph.issued": { "gte": "{{dateFrom}}" } } }
                                    {{/dateTo}}{{/dateFrom}}
                                    {{^dateFrom}}{{#dateTo}}
                                    ,{ "range": { "@graph.issued": { "lte": "{{dateTo}}" } } }
                                    {{/dateTo}}{{/dateFrom}}
                                  ]
                                }
                              },
                              {
                                "bool": {
                                  "must": [ { "term": { "@graph.@type": "Grant" } } ],
                                  "should": [
                                    {
                                      "bool": {
                                        "must": [
                                          { "exists": { "field": "@graph.dateTimeInterval.start.dateTime" } },
                                          { "exists": { "field": "@graph.dateTimeInterval.end.dateTime" } }
                                          {{#dateFrom}}{{#dateTo}}
                                          ,{ "range": { "@graph.dateTimeInterval.start.dateTime": { "lte": "{{dateTo}}" } } }
                                          ,{ "range": { "@graph.dateTimeInterval.end.dateTime":   { "gte": "{{dateFrom}}" } } }
                                          {{/dateTo}}{{/dateFrom}}
                                          {{#dateFrom}}{{^dateTo}}
                                          ,{ "range": { "@graph.dateTimeInterval.end.dateTime":   { "gte": "{{dateFrom}}" } } }
                                          {{/dateTo}}{{/dateFrom}}
                                          {{^dateFrom}}{{#dateTo}}
                                          ,{ "range": { "@graph.dateTimeInterval.start.dateTime": { "lte": "{{dateTo}}" } } }
                                          {{/dateTo}}{{/dateFrom}}
                                        ]
                                      }
                                    },
                                    {
                                      "bool": {
                                        "must": [
                                          { "exists": { "field": "@graph.dateTimeInterval.start.dateTime" } },
                                          { "bool": { "must_not": [ { "exists": { "field": "@graph.dateTimeInterval.end.dateTime" } } ] } }
                                          {{#dateTo}}
                                          ,{ "range": { "@graph.dateTimeInterval.start.dateTime": { "lte": "{{dateTo}}" } } }
                                          {{/dateTo}}
                                        ]
                                      }
                                    },
                                    {
                                      "bool": {
                                        "must": [
                                          { "exists": { "field": "@graph.dateTimeInterval.end.dateTime" } },
                                          { "bool": { "must_not": [ { "exists": { "field": "@graph.dateTimeInterval.start.dateTime" } } ] } }
                                          {{#dateFrom}}
                                          ,{ "range": { "@graph.dateTimeInterval.end.dateTime":   { "gte": "{{dateFrom}}" } } }
                                          {{/dateFrom}}
                                        ]
                                      }
                                    }
                                  ],
                                  "minimum_should_match": 1
                                }
                              }
                            ],
                            "minimum_should_match": 1
                          }
                        }
                        {{/hasDate}}
                      ]
                    }
                  },
                  "min_score": {{min_nested_score}}{{^min_nested_score}}1.0{{/min_nested_score}},
                  "boost_mode": "replace"
                }
              },
              "inner_hits": {
                "size": {{inner_hits_size}}{{^inner_hits_size}}500{{/inner_hits_size}},
                "_source": [
                  "@graph.@id",
                  "@graph.@type",
                  "@graph.name",
                  "_score"
                ]
              },
              "score_mode": "sum"
            }
          }
          {{/q}}
        }
      },
      "aggs": {
        "@type": { "terms": { "field": "@type", "size": 20 } },
        "availability": { "terms": { "field": "hasAvailability.prefLabel", "size": 10 } },
        "status": { "terms": { "field": "status", "size": 10 } },
        "type": { "terms": { "field": "type", "size": 10 } },

        "issued_years": {
          "nested": { "path": "@graph" },
          "aggs": {
            "works": {
              "filter": {
                "bool": {
                  "must": [
                    { "term": { "@graph.@type": "Work" } },
                    { "exists": { "field": "@graph.issued" } },
                    {
                      "simple_query_string": {
                        "query": "{{q}}",
                        "fields": [
                          "@graph.@id^10",
                          "@graph.relates^2",
                          "@graph.DOI^10",
                          "@graph.abstract^5",
                          "@graph.contactInfo.hasEmail^10",
                          "@graph.contactInfo.hasName.family^20",
                          "@graph.contactInfo.hasName.given^5",
                          "@graph.contactInfo.hasName.middle^5",
                          "@graph.contactInfo.hasTitle.name^5",
                          "@graph.contactInfo.hasURL.name^5",
                          "@graph.contactInfo.hasOrganizationalUnit.name^5",
                          "@graph.name^10",
                          "@graph.orcidId^10",
                          "@graph.overview^5",
                          "@graph.identifier^10",
                          "@graph.container-title^5",
                          "@graph.publisher^5",
                          "@graph.title^10",
                          "@graph.author.family^10",
                          "@graph.author.given^5",
                          "@graph.relatedBy.relates.name^5"
                        ],
                        "default_operator": "and"
                      }
                    },
                    {
                      "bool": {
                        "should": [
                          {
                            "bool": {
                              "must": [
                                { "exists": { "field": "@graph.is-visible" } },
                                { "term":  { "@graph.is-visible": true } }
                              ]
                            }
                          },
                          {
                            "bool": {
                              "must": [
                                { "exists": { "field": "@graph.relatedBy.is-visible" } },
                                { "term":  { "@graph.relatedBy.is-visible": true } }
                              ]
                            }
                          }
                        ],
                        "minimum_should_match": 1
                      }
                    }
                  ]
                }
              },
              "aggs": {
                "years": {
                  "date_histogram": {
                    "field": "@graph.issued",
                    "calendar_interval": "year",
                    "min_doc_count": 0,
                    "time_zone": "UTC"
                  },
                  "aggs": {
                    "unique_works": {
                      "cardinality": {
                        "field": "@graph.@id",
                        "precision_threshold": 40000
                      }
                    }
                  }
                }
              }
            },

            "grants_active": {
              "filter": {
                "bool": {
                  "must": [
                    { "term": { "@graph.@type": "Grant" } },
                    {
                      "simple_query_string": {
                        "query": "{{q}}",
                        "fields": [
                          "@graph.@id^10",
                          "@graph.relates^2",
                          "@graph.DOI^10",
                          "@graph.abstract^5",
                          "@graph.contactInfo.hasEmail^10",
                          "@graph.contactInfo.hasName.family^20",
                          "@graph.contactInfo.hasName.given^5",
                          "@graph.contactInfo.hasName.middle^5",
                          "@graph.contactInfo.hasTitle.name^5",
                          "@graph.contactInfo.hasURL.name^5",
                          "@graph.contactInfo.hasOrganizationalUnit.name^5",
                          "@graph.name^10",
                          "@graph.orcidId^10",
                          "@graph.overview^5",
                          "@graph.identifier^10",
                          "@graph.container-title^5",
                          "@graph.publisher^5",
                          "@graph.title^10",
                          "@graph.author.family^10",
                          "@graph.author.given^5",
                          "@graph.relatedBy.relates.name^5"
                        ],
                        "default_operator": "and"
                      }
                    },
                    {
                      "bool": {
                        "should": [
                          {
                            "bool": {
                              "must": [
                                { "exists": { "field": "@graph.is-visible" } },
                                { "term":  { "@graph.is-visible": true } }
                              ]
                            }
                          },
                          {
                            "bool": {
                              "must": [
                                { "exists": { "field": "@graph.relatedBy.is-visible" } },
                                { "term":  { "@graph.relatedBy.is-visible": true } }
                              ]
                            }
                          }
                        ],
                        "minimum_should_match": 1
                      }
                    }
                  ]
                }
              },
              "aggs": {
                "years": {
                  "date_histogram": {
                    "field": "@graph.graph_active_year",
                    "calendar_interval": "year",
                    "min_doc_count": 0,
                    "time_zone": "UTC"
                  },
                  "aggs": {
                    "parent_docs": {
                      "reverse_nested": {},
                      "aggs": {
                        "unique_parents": { "cardinality": { "field": "@id" } }
                      }
                    },
                    "unique_grants": {
                      "cardinality": {
                        "field": "@graph.@id",
                        "precision_threshold": 40000
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "_source": [
        "@id","@type","name","contactInfo","title","issued","container-title","type","DOI",
        "modified-date","status","author","volume","issue","page","abstract","sponsorAwardId",
        "assignedBy","dateTimeInterval","relatedBy","_score"
      ],
      "sort": ["_score","@type","name.kw"],
      "from": {{from}}{{^from}}0{{/from}},
      "size": {{size}}{{^size}}10{{/size}},
      "min_score": {{min_score}}{{^min_score}}5.0{{/min_score}},
      "runtime_mappings": {
        "@graph.graph_active_year": {
          "type": "date",
          "script": {
            "source": "boolean hasStart = !doc['@graph.dateTimeInterval.start.dateTime'].empty; boolean hasEnd = !doc['@graph.dateTimeInterval.end.dateTime'].empty; if (!hasStart && !hasEnd) return; Instant startI = hasStart ? doc['@graph.dateTimeInterval.start.dateTime'].value.toInstant() : null; Instant endI = hasEnd ? doc['@graph.dateTimeInterval.end.dateTime'].value.toInstant() : Instant.ofEpochMilli(new Date().getTime()); int ys = hasStart ? ZonedDateTime.ofInstant(startI, ZoneOffset.UTC).getYear() : ZonedDateTime.ofInstant(endI, ZoneOffset.UTC).getYear(); int ye = ZonedDateTime.ofInstant(endI, ZoneOffset.UTC).getYear(); if (!hasStart) { emit(ZonedDateTime.of(ys,1,1,0,0,0,0, ZoneOffset.UTC).toInstant().toEpochMilli()); return; } if (ye < ys) { emit(ZonedDateTime.of(ys,1,1,0,0,0,0, ZoneOffset.UTC).toInstant().toEpochMilli()); return; } for (int y = ys; y <= ye; y++) { emit(ZonedDateTime.of(y,1,1,0,0,0,0, ZoneOffset.UTC).toInstant().toEpochMilli()); }"
          }
        }
      }
    }`,
    "params": {
      "q": "My query string",
      "min_nested_score": 10.0,
      "min_score": 10.0
    }
  }
};

module.exports = template;
