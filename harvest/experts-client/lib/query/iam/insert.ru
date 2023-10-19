PREFIX expert: <http://experts.ucdavis.edu/expert/>
PREFIX experts: <http://experts.ucdavis.edu/>
PREFIX iam: <http://iam.ucdavis.edu/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX schema: <http://schema.org/>
PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>


insert { graph iam: { ?ns ?p ?no. ?no vcard:title ?title } } where {
  SERVICE ?EXPERTS_SERVICE__ {
    bind(uri(concat(str(experts:),'person/',MD5(?USERNAME__))) as ?user)
    graph iam: {
      # Not yet updated
      ?user a ucdlib:Person . ?s ?p ?o.
      optional { ?o vcard:title ?title }
      filter(regex(str(?s),concat('^',str(?user),'#?')))
      bind(uri(replace(str(?s),'/person/','/expert/')) as ?ns)
      bind(if(isURI(?o),
          uri(replace(str(?o),'/person/','/expert/')),?o) as ?no)
    }
  }
};

# Make Persons Experts
insert { graph iam: { ?user a ucdlib:Expert } } WHERE { graph iam: { ?user a ucdlib:Person } } ;

# Now we need to add our vcard name for each IAM user
insert { graph iam: { ?vcard schema:name ?vcard_label; } } where {
    bind(uri(concat(str(expert:),MD5(?USERNAME__))) as ?user)
    graph iam: {
      ?user obo:ARG_2000028 ?vcard .
      ?vcard vcard:hasName ?vcard_name .

      ?vcard_name vcard:familyName ?ln .

      optional {
        ?vcard_name vcard:givenName ?fn .
      }
      optional {
        ?vcard vcard:hasTitle/vcard:title ?title .
      }
      optional {
        ?vcard vcard:hasOrganizationalUnit/vcard:title ?dept .
      }

      bind(coalesce(concat(" § ",?title,coalesce(concat(", ",?dept),"")),
                    "") as ?title_dept)

      bind(concat(
                  concat(?ln,coalesce(concat(", ",?fn),"")),
                  coalesce(?title_dept,"")
                  ) as ?vcard_label)
    }
};
