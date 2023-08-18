PREFIX person: <http://experts.ucdavis.edu/person/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX experts: <http://experts.ucdavis.edu/schema#>
PREFIX vivo: <http://vivoweb.org/ontology/core#>
PREFIX fis: <http://experts.ucdavis.edu/fis/>
insert graph fis: {
  ?grant ?p ?o .
  ?duration ?dp ?do.
  ?start ?sp ?so.
  ?end ?ep ?eo.
  ?relates ?rp ?ro.
}
WHERE {
  SERVICE ?EXPERTS_SERVICE__ {
    graph fis: {
      bind(uri(concat(str(person:),MD5(?USERNAME__))) as ?user)
      ?grant a vivo:Grant;
             ?p ?o;
             vivo:relates/obo:RO_0000052 ?user;
             .
      OPTIONAL {
        ?grant vivo:dateTimeInterval ?duration.
        ?duration ?dp ?do.
        OPTIONAL { ?duration vivo:start ?start.
          ?start ?sp ?so.
        }
        OPTIONAL { ?duration vivo:end ?start.
          ?end ?ep ?eo.
        }
      }
      OPTIONAL {
        ?grant vivo:relates ?relates.
        ?relates ?rp ?ro.
        filter ( EXISTS { ?relates a vivo:AdminRole. } || EXISTS { ?relates obo:RO_0000052 ?user .} )
      }
    }
  }
}
