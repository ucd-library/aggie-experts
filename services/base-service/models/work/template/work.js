const q= {
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
                  }
                ]
              }
            }
          ]
        }
      },
      "inner_hits": {
        "size": "{{inner_hits_size}}{{^inner_hits_size}}5{{/inner_hits_size}}",
        "_source": [
          "@graph.@type",
          "@graph.name"
        ]
      },
      "score_mode": "sum"
    }
  }
}

template = {
  id: "work",
  script: {
    "lang":"mustache"
  },
  query: `{"bool": {
          "filter": {
            "bool":{
              "must": [
                {
                  "bool": {
                    "must": [
                      { "exists": { "field": "is-visible" }},
                      { "term" : {"is-visible": true } },
                      { "exists": { "field": "@type" }},
                      { "term" : {"@type": "Work" } }
                    ]
                  }
                }
              ]
            }
          }
          {{#q}},"must":${JSON.stringify(q.must)}{{/q}}
        }}`
}

template.script.source=`{
      "query": ${template.query},
      "aggs": {
        "type": {
          "terms": {
            "field": "@type",
            "size": 20
          }
         }
      },
      "_source": [
        "@id",
        "@type",
        "name"
      ],
      "sort": [
        "_score",
        "@type",
        "name.kw"
      ],
      "from": "{{from}}{{^from}}0{{/from}}",
      "size": "{{size}}{{^size}}10{{/size}}"
    },
    "params": {
      "q": "My query string"
    }
  }`

module.exports = template;
