#! /usr/bin/make -f
SH:=/bin/bash

academic_titles:=academic_titles.txt
ae_titles:=titles-ae.csv

define cto_context
{"@context": {"@vocab": "http://schema.org/","@base":"ark:/87287/d7c08j/cto/"}}
endef

define pos_context
{"@context": {\
"@vocab": "http://schema.org/",\
"@base":"ark:/87287/d7c08j/position/",\
"skos":"http://www.w3.org/2004/02/skos/core#",\
"c": "http://experts.ucdavis.edu/cto/",\
"prefLabel": {"@id":"skos:prefLabel"},\
"cto": { "@type":"@id","@id":"http://schema.library.ucdavis.edu/schema#cto"}\
}}
endef

info::
	@echo '${context}'

cto_codes.jsonld: ${academic_titles}
	sed -e 's/ \(00\|CWR\).*//' $< | sort -u |\
	sed -e 's/\([^ ]*\) \(.*\)/{"@id":"\1","name":"\2"}/' |\
	jq --slurp '${cto_context} + {"@graph":.}' > $@

pos_codes.jsonld: ${ae_titles}
	sed -E 's/^([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*).*/{"name":"\1","@id":"\2","cto":"c:\4","prefLabel":"\6"}/' $< | \
	jq -s 'def lpad(n; pad): if (n - length > 0) then (n - length) as $$len | pad * $$len + . else . end; def format_cto(cto): "c:" + (cto | capture("(?<num>[0-9]+)") | .num | tonumber | tostring | lpad(3; "0")); map(.["@id"] |= (tostring | lpad(6; "0"))) | map(.cto |= format_cto(.))' |\
  jq --slurp '${pos_context} + {"@graph":.}' > $@

pps.titles.jsonld:
	../../ucdid fetch --format=jsonld pps.titles > $@

http:=http --auth=admin:testing123
db:=http://localhost:3030
dbName:=position

.PHONY: upload
upload:cto_codes.jsonld pos_codes.jsonld
	${http} DELETE ${db}/$$/datasets/${dbName}
	${http} POST ${db}/$$/datasets dbType==tdb dbName==${dbName}
	${http} POST ${db}/${dbName}/data Content-type:application/ld+json < cto_codes.jsonld
	${http} POST ${db}/${dbName}/data Content-type:application/ld+json < pos_codes.jsonld
	${http} POST ${db}/${dbName}/data Content-type:application/ld+json < pps.titles.jsonld

positions.n3:
	${http} POST ${db}/${dbName}/query Content-type:application/sparql-query Accept:application/n-triples < positions.rq > $@

positions.hdt:positions.n3
	rdf2hdt.sh -index -rdftype ntriples $< $@
