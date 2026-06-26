// Sort key: 0 for A-Z items, 1 for # items — used when sortNumericLast param is set.
// name.first stores 'other' (not '1') for non-alpha names due to the starts_with normalizer's
// non_letter_filter which replaces any non-letter first char with the literal string 'other'.
const SORT_NUMERIC_LAST_SCRIPT = `
  if (doc['name.first'].size() == 0) return 0;
  return doc['name.first'].value == 'other' ? 1 : 0;
`.replace(/\n\s*/g, ' ').trim();

const GRANT_ACTIVE_YEAR_SCRIPT = `
  def src = params._source;
  def dti = null;
  if (src.containsKey('dateTimeInterval')) {
    dti = src['dateTimeInterval'];
  } else if (src.containsKey('@graph')) {
    for (def g : src['@graph']) {
      if (g.containsKey('dateTimeInterval')) { dti = g['dateTimeInterval']; break; }
    }
  }
  if (dti == null) return;
  def startStr = dti?.start?.dateTime;
  def endStr = dti?.end?.dateTime;
  if (startStr == null && endStr == null) return;
  int ys = startStr != null ? Integer.parseInt(startStr.substring(0,4)) : Integer.parseInt(endStr.substring(0,4));
  int ye = endStr != null ? Integer.parseInt(endStr.substring(0,4)) : ys;
  if (ye < ys) ye = ys;
  for (int y = ys; y <= ye; y++) {
    emit(ZonedDateTime.of(y,1,1,0,0,0,0,ZoneOffset.UTC).toInstant().toEpochMilli());
  }
`.replace(/\n\s*/g, ' ').trim();

const source = `{
  "query": {
    "bool": {
      "must": [
        {{#p}}{"term":{"name.first":"{{p}}"}}{{/p}}
        {{^p}}{"match_all":{}}{{/p}}
      ],
      "filter": {
        "bool": {
          "must": [
            {"exists":{"field":"is-visible"}},
            {"term":{"is-visible":true}}
            {{#dept}}
            ,{"exists":{"field":"hasOrganizationalUnit.name.kw"}}
            ,{"terms":{"hasOrganizationalUnit.name.kw":{{#toJson}}dept{{/toJson}}}}
            {{/dept}}
            {{#status}}
            ,{"terms":{"status":{{#toJson}}status{{/toJson}}}}
            {{/status}}
            {{#type}}
            ,{"terms":{"type":{{#toJson}}type{{/toJson}}}}
            {{/type}}
            {{#availability}}
            ,{"exists":{"field":"hasAvailability.prefLabel"}}
            ,{"terms":{"hasAvailability.prefLabel":{{#toJson}}availability{{/toJson}}}}
            {{/availability}}
            {{#dateFrom}}
            ,{"bool":{"should":[
              {"nested":{"path":"@graph","query":{"bool":{"must":[{"exists":{"field":"@graph.issued"}},{"range":{"@graph.issued":{"gte":"{{dateFrom}}"{{#dateTo}},"lte":"{{dateTo}}"{{/dateTo}}}}}]}}}},
              {"range":{"grant_active_year":{"gte":"{{dateFrom}}"{{#dateTo}},"lte":"{{dateTo}}"{{/dateTo}}}}}
            ],"minimum_should_match":1}}
            {{/dateFrom}}
            {{^dateFrom}}{{#dateTo}}
            ,{"bool":{"should":[
              {"nested":{"path":"@graph","query":{"bool":{"must":[{"exists":{"field":"@graph.issued"}},{"range":{"@graph.issued":{"lte":"{{dateTo}}"}}}]}}}},
              {"range":{"grant_active_year":{"lte":"{{dateTo}}"}}}
            ],"minimum_should_match":1}}
            {{/dateTo}}{{/dateFrom}}
          ]
        }
      }
    }
  },
  "_source": ["@id","@type","is-visible","name"],
  {{#sortNumericLast}}
  "sort": [{"_script":{"type":"number","order":"asc","script":{"source":"${SORT_NUMERIC_LAST_SCRIPT}"}}},{"name.kw":{"mode":"max","order":"asc"}}],
  {{/sortNumericLast}}
  {{^sortNumericLast}}
  "sort": {"name.kw":{"mode":"max","order":"asc"}},
  {{/sortNumericLast}}
  "from": "{{from}}{{^from}}0{{/from}}",
  "size": "{{size}}{{^size}}25{{/size}}",
  "runtime_mappings": {
    "grant_active_year": {
      "type": "date",
      "script": { "source": "${GRANT_ACTIVE_YEAR_SCRIPT}" }
    }
  },
  "aggs": {
    "status": {"terms":{"field":"status","size":10}},
    "type": {"terms":{"field":"type","size":10}},
    "work_years": {"nested":{"path":"@graph"},"aggs":{"years":{"date_histogram":{"field":"@graph.issued","calendar_interval":"year","min_doc_count":1,"time_zone":"UTC"}}}},
    "grant_years": {"date_histogram":{"field":"grant_active_year","calendar_interval":"year","min_doc_count":1,"time_zone":"UTC"}},
    "expert_years": {"nested":{"path":"@graph"},"aggs":{"years":{"date_histogram":{"field":"@graph.issued","calendar_interval":"year","min_doc_count":1,"time_zone":"UTC"}}}}
  }
}`;

module.exports = {
  id: "name",
  script: {
    lang: "mustache",
    source,
    params: { p: "A" }
  }
};
