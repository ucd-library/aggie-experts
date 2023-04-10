construct { ?s ?p ?o. }
WHERE {
  graph ?g {
  {
  BIND(?uri AS ?m)
  ?m a [].
  ?s a [];
     ?p ?o.
  filter(regex(str(?s),concat("^",str(?m),"(#|$)")))
} } }
