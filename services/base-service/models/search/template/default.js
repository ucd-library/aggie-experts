template = {
  id: "default",
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
                }
                {{#hasAvailability}}
                ,{
                  "bool": {
                    "must": [
                      { "exists": { "field": "hasAvailability" }},
                      { "terms": {
                        "hasAvailability": [{{#hasAvailability}}"{{.}}",{{/hasAvailability}}"none"]
                       }}
                    ]
                  }
                }
                {{/hasAvailability}}
              ]
            }
          },
          "must":{
            "nested": {
              "path": "@graph",
              "query": {
                "bool" : {
                  "must": [
                    {
                      "multi_match": {
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
                        ]
                      } } ],
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
                        ]
                      }
                    }
                  ]
                }
              },
              "inner_hits": {
                "size": "{{inner_hits_size}}{{^inner_hits_size}}50{{/inner_hits_size}}",
                "_source": [
                  "@graph.@type",
                  "@graph.name",
                  "@graph.author",
                  "@graph.title",
                  "@graph.issued",
                  "@graph.container-title",
                  "@graph.type",
                  "@graph.ISSN",
                  "@graph.abstract",
                  "@graph.genre",
                  "@graph.issued",
                  "@graph.status",
                  "@graph.rank",
                  "@graph.ISBN",
                  "@graph.volume",
                  "@graph.page"
                ]
              },
              "score_mode": "sum"
            }
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
        "DOI"
      ],
      "sort": [
        "_score"
      ],
      "from": "{{from}}{{^from}}0{{/from}}",
      "size": "{{size}}{{^size}}10{{/size}}"
    },
    "params": {
      "q": "My query string"
    }
  }`
  }
};
module.exports = template;
