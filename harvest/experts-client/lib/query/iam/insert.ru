PREFIX experts: <http://experts.ucdavis.edu/>
PREFIX person: <http://experts.ucdavis.edu/person/>
PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
PREFIX iam: <http://iam.ucdavis.edu/>
insert { graph iam: { ?s ?p ?o } } where {
  SERVICE ?EXPERTS_SERVICE__ {
    bind(uri(concat(str(person:),MD5(?USERNAME__))) as ?user)
    graph iam: {
      ?user a ucdlib:Person . ?s ?p ?o.
      filter(regex(str(?s),concat('^',str(?user),'#?')))
    }
  }
}
