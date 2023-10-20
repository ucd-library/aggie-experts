PREFIX : <ark:/87287/d7gt0q/schema#>
PREFIX deleted: <ark:/99999/deleted>
PREFIX iam: <http://iam.ucdavis.edu/>
PREFIX experts: <http://experts.ucdavis.edu/>
PREFIX grant: <ark:/87287/d7gt0q/grant/>
PREFIX kfs: <ark:/87287/d7gt0q/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX expert: <http://experts.ucdavis.edu/expert/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
PREFIX vivo: <http://vivoweb.org/ontology/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

# Relationships
delete { graph kfs: { ?relates ?p ?o. } }
insert { graph deleted: { ?relates ?p ?o. } }
  #construct { ?relates ?p ?o. }
  WHERE {
    graph kfs: {
    ?grant vivo:dateTimeInterval/vivo:end/vivo:dateTime ?end_date;
             vivo:relates ?relates;
             .
      ?relates ?p ?o.
      filter(xsd:date(?end_date) > '2024-11-01'^^xsd:date)
    }
  };
# subaward
 delete { graph kfs: { ?super ?p ?o. ?reverse ?rp ?super. } }
 insert { graph deleted: { ?super ?p ?o. ?reverse ?rp ?super. } }
#  construct { ?super ?p ?o. ?reverse ?rp ?super.}
      WHERE {
        graph kfs: {
          ?grant vivo:dateTimeInterval/vivo:end/vivo:dateTime ?end_date;
                 ucdlib:subAwardOf ?super;
                 .
          ?super ?p ?o.
          ?reverse ?rp ?super.
          filter(xsd:date(?end_date) > '2024-11-01'^^xsd:date)
        }
      };
# Grants and times
delete { graph kfs: { ?grant ?p ?o. ?reverse ?rp ?grant. ?io ?pp ?po. ?int ?ip ?io. } }
insert { graph deleted: { ?grant ?p ?o. ?reverse ?rp ?grant. ?io ?pp ?po. ?int ?ip ?io. } }
#  construct { ?grant ?p ?o. ?reverse ?rp ?grant}
      WHERE {
        graph kfs: {
          ?grant vivo:dateTimeInterval/vivo:end/vivo:dateTime ?end_date;
                 vivo:dateTimeInterval ?interval;
                 ?p ?o;
                 .
          ?reverse ?rp ?grant.

          ?interval ?ip ?io.
          ?io ?pp ?po.

          filter(xsd:date(?end_date) > '2024-11-01'^^xsd:date)
        }
      };
