PREFIX : <ark:/87287/d7gt0q/schema#>
PREFIX aggie_enterprise: <ark:/87287/d7c08j/>
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

#
# This query is currently not working, we need a list of the grants that have
# been moved to aggie_enterprise.
#

delete { graph kfs: { ?p ?pp ?po. ?int ?ip ?io. } }
insert { graph aggie_enterprise: { ?p ?pp ?po. ?int ?ip ?io. } }
WHERE {
  VALUES ?se {vivo:start vivo:end }
  service <http://fuseki:3030/grants/> {
    ?new_grant ucdlib:oracle_award_number ?oracle.
  }
  graph kfs: {
    ?grant ucdlib:oracle_award_number ?oracle;
           vivo:dateTimeInterval ?int;
           .
    ?int ?se ?p.
    ?int ?ip ?io.
    ?p ?pp ?po.
  }
};
# Relationships
delete { graph kfs: { ?relates ?p ?o. } }
insert { graph aggie_enterprise: { ?relates ?p ?o. } }
  #construct { ?relates ?p ?o. }
WHERE {
  service <http://fuseki:3030/grants/> {
    ?new_grant ucdlib:oracle_award_number ?oracle.
  }
  graph kfs: {
    ?grant ucdlib:oracle_award_number ?oracle;
           vivo:relates ?relates;
           .
    ?relates ?p ?o.
  }
};
# subaward
 delete { graph kfs: { ?super ?p ?o. ?reverse ?rp ?super. } }
 insert { graph aggie_enterprise: { ?super ?p ?o. ?reverse ?rp ?super. } }
#  construct { ?super ?p ?o. ?reverse ?rp ?super.}
WHERE {
  service <http://fuseki:3030/grants/> {
    ?new_grant ucdlib:oracle_award_number ?oracle.
  }
  graph kfs: {
    ?grant ucdlib:oracle_award_number ?oracle;
           ucdlib:subAwardOf ?super;
           .
    ?super ?p ?o.
    ?reverse ?rp ?super.

  }
};
# Grants
delete { graph kfs: { ?grant ?p ?o. ?reverse ?rp ?grant. } }
insert { graph aggie_enterprise: { ?grant ?p ?o. ?reverse ?rp ?grant. } }
#  construct { ?grant ?p ?o. ?reverse ?rp ?grant}
WHERE {
  service <http://fuseki:3030/grants/> {
    ?new_grant ucdlib:oracle_award_number ?oracle.
  }
  graph kfs: {
    ?grant ucdlib:oracle_award_number ?oracle;
           ?p ?o;
           .
    ?reverse ?rp ?grant.

  }
};
