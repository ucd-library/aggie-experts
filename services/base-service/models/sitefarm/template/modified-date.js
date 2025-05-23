template = {
  id: "modified-date",
  script: {
    "lang": "mustache",
    "source": `{
      "query": {
        "bool": {
          "filter": {
            "bool": {
              "must": [
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
                {{#gte_date}}
                ,{
                  "range": {
                    "modified-date": {
                      "gte": "{{gte_date}}"
                    }
                  }
                }
                {{/gte_date}}
                ,{
                  "terms": {
                      "@id": {{#toJson}}expert{{/toJson}}
                  }
                }
              ]
            }
          }
        }
      }
    }`
  }

}
module.exports = template;
