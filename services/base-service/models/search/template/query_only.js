template = {
  id: "query_only",
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
              ]
            }
          }
          {{#q}}
          ,"must":{
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
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              "score_mode": "sum"
            }
          }
          {{/q}}
        }
      },
      "aggs": {
        "type": {
          "terms": {
            "field": "@type",
            "size": 20
          }
        },
        "availability": {
          "terms": {
            "field": "hasAvailability",
            "size": 10
          }
        },
        "status": {
          "terms": {
            "field": "status",
            "size": 10
          }
        }
      },
      "size": 0
    },
    "params": {
      "q": "My query string"
    }
  }`
  }
};
module.exports = template;
