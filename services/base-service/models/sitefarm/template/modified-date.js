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
                    "must": [
                      { "exists": { "field": "is-visible" }},
                      { "term" : {"is-visible": true } }
                    ]
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
                      "@id": "{{#toJson}}expert{{/toJson}}"
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
