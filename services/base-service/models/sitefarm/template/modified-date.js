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
                },
                {
                  "bool": {
                    "should": [
                      {
                        "range": {
                          "modified-date": {
                            "gte": "{{gte_date}}"
                          }
                        }
                      }
                    ]
                  }
                },
                {
                  "terms": {
                      "expertId": [{{#expertIds}}"{{.}}",{{/expertIds}}""]
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
