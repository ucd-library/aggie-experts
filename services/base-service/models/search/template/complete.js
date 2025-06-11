template = {
  id: "complete",
  script: {
    "lang": "mustache",
    "source": `{
      "query": {
        "bool": {
          "filter": {
            "bool":{
              "must": [
                {
                  "bool": {
                    "must": [
                      { "exists": { "field": "is-visible" }},
                      { "term" : {"is-visible": true } }
                    ]
                  }
                },
                {
                  "bool": {
                    "should": [
                      {
                        "bool": {
                          "must": [
                            { "term": { "@type": "Expert" }}
                            {{#availability}}
                            ,{
                              "bool": {
                                "must": [
                                  { "exists": { "field": "hasAvailability.prefLabel" }},
                                  { "terms": {
                                    "hasAvailability.prefLabel": {{#toJson}}availability{{/toJson}}
                                  }}
                                ]
                              }
                            }
                            {{/availability}}
                            {{#expert}}
                            ,{ "terms": {
                              "@id": {{#toJson}}expert{{/toJson}}
                             }}
                             {{/expert}}
                          ]
                        }
                      },
                      {
                        "bool": {
                          "must_not": [
                            { "term": { "@type": "Expert" }}
                          ]
                          {{#expert}}
                          ,"must": {
                            "nested": {
                                "path": "@graph",
                                "query": {
                                  "bool": {
                                    "must": [
                                        { "exists": { "field": "@graph.@id" }},
                                        { "terms": {
                                        "@graph.@id": {{#toJson}}expert{{/toJson}}
                                     }}
                                    ]
                                  }
                                }
                            }}
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
                      { "exists": { "field": "status" }},
                      { "terms": {
                        "status": [{{#status}}"{{.}}",{{/status}}"none"]
                       }}
                    ]
                  }
                }
                {{/status}}
                {{#type}}
                ,{
                  "bool": {
                    "must": [
                      { "exists": { "field": "type" }},
                      { "terms": {
                        "type": [{{#type}}"{{.}}",{{/type}}"none"]
                       }}
                    ]
                  }
                }
                {{/type}}
              ]
            }
          }
          {{#q}}
          ,"must":{
            "nested": {
              "path": "@graph",
              "query": {
                "function_score": {
                   "query": {
                        "bool" : {
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
                                  "@graph.abstract^5",
                                  "@graph.identifier^10",
                                  "@graph.container-title^5",
                                  "@graph.publisher^5",
                                  "@graph.title^10"
                                ],
                                "default_operator": "and"
                              } } ],
                            "filter": [
                            {
                              "bool": {
                                "must": [
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
                                ]
                              }
                            }
                          ]
                        }
                      },
                      "min_score": {{min_nested_score}}{{^min_nested_score}}1.0{{/min_nested_score}},
                      "boost_mode": "replace"
                   }
              },
              "inner_hits": {
                "size": "{{inner_hits_size}}{{^inner_hits_size}}500{{/inner_hits_size}}",
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
        "@type": {
          "terms": {
            "field": "@type",
            "size": 20
          }
        },
        "availability": {
          "terms": {
            "field": "hasAvailability.prefLabel",
            "size": 10
          }
        },
        "status": {
          "terms": {
            "field": "status",
            "size": 10
          }
        },
        "type": {
          "terms": {
            "field": "type",
            "size": 10
          }
        }
      },
      "_source": [
        "@id",
        "@type",
        "name",
        "contactInfo",
        "title",
        "issued",
        "container-title",
        "type",
        "DOI",
        "modified-date",
        "status",
        "author",
        "volume",
        "issue",
        "page",
        "abstract",
        "sponsorAwardId",
        "assignedBy",
        "dateTimeInterval",
        "relatedBy",
        "_score"
      ],
      "sort": [
        "_score",
        "@type",
        "name.kw"
      ],
      "from": "{{from}}{{^from}}0{{/from}}",
      "size": "{{size}}{{^size}}10{{/size}}",
      "min_score": "{{min_score}}{{^min_score}}5.0{{/min_score}}"
    },
    "params": {
      "q": "My query string",
      "min_nested_score": 10.0,
      "min_score": 10.0,
    }
  }`
  }
};

module.exports = template;
