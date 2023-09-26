PREFIX : <ark:/87287/d7gt0q/schema#>
PREFIX deleted: <ark:/99999/deleted>
PREFIX iam: <http://iam.ucdavis.edu/>
PREFIX experts: <http://experts.ucdavis.edu/>
PREFIX grant: <ark:/87287/d7gt0q/grant/>
PREFIX kfs: <ark:/87287/d7gt0q/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX person: <http://experts.ucdavis.edu/person/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
PREFIX vivo: <http://vivoweb.org/ontology/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

delete { graph kfs: { ?p ?pp ?po. ?int ?ip ?io. } }
insert { graph deleted: { ?p ?pp ?po. ?int ?ip ?io. } }
WHERE {
  VALUES ?se {vivo:start vivo:end }
  graph kfs: {
    ?grant vivo:totalAwardAmount 0;
           vivo:dateTimeInterval ?int;
           .
    ?int ?se ?p.
    ?int ?ip ?io.
    ?p ?pp ?po.
  }
};
# Relationships
delete { graph kfs: { ?relates ?p ?o. } }
insert { graph deleted: { ?relates ?p ?o. } }
  #construct { ?relates ?p ?o. }
  WHERE {
    graph kfs: {
    ?grant vivo:totalAwardAmount 0;
             vivo:relates ?relates;
             .
      ?relates ?p ?o.
    }
  };
# subaward
 delete { graph kfs: { ?super ?p ?o. ?reverse ?rp ?super. } }
 insert { graph deleted: { ?super ?p ?o. ?reverse ?rp ?super. } }
#  construct { ?super ?p ?o. ?reverse ?rp ?super.}
      WHERE {
        graph kfs: {
          ?grant vivo:totalAwardAmount 0;
                 ucdlib:subAwardOf ?super;
                 .
          ?super ?p ?o.
          ?reverse ?rp ?super.

        }
      };
# Grants
delete { graph kfs: { ?grant ?p ?o. ?reverse ?rp ?grant. } }
insert { graph deleted: { ?grant ?p ?o. ?reverse ?rp ?grant. } }
#  construct { ?grant ?p ?o. ?reverse ?rp ?grant}
      WHERE {
        graph kfs: {
          ?grant vivo:totalAwardAmount 0;
                 ?p ?o;
                 .
          ?reverse ?rp ?grant.

        }
      };
