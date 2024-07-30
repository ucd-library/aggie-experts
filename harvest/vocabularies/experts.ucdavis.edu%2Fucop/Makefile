#! /usr/bin/make -f
SH:=/bin/bash

academic_titles:=academic_titles.txt
ae_titles:=titles-ae.csv

define cto_context
{"@context": {"@vocab": "http://schema.org/","@base": "http://experts.ucdavis.edu/cto/"}}
endef

pos_context:=\
'{"@context": {\
"@vocab": "http://schema.org/",\
"@base": "http://experts.ucdavis.edu/position/",\
"c": "http://experts.ucdavis.edu/cto/",\
"cto": { "@type":"@id","@id":"http://schema.library.ucdavis.edu/schema#cto"}\
}}'

info::
	@echo '${context}'

cto_codes.jsonld: ${academic_titles}
	sed -e 's/ \(00\|CWR\).*//' $< | sort -u |\
	sed -e 's/\([^ ]*\) \(.*\)/{"@id":"\1","name":"\2"}/' |\
	jq --slurp '${cto_context} + {"@graph":.}' > $@

pos_codes.jsonld: ${ae_titles}
	sed -E 's/^([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*).*/{"name":"\1","@id":"\2","cto":"c:\4","preferred_name":"\6"}/' $< | \
	 jq -s 'def lpad(n; pad): if (n - length > 0) then (n - length) as $$len | pad * $$len + . else . end; def format_cto(cto): "c:" + (cto | tostring | lpad(3; "0")); map(.["@id"] |= (tostring | lpad(6; "0"))) | map(.cto |= format_cto(.cto))' | \
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
	${http} POST ${db}/${dbName}/query Content-type:application/sparql-query Accept:text/n3 < positions.rq

positions.hdt:positions.n3
	rdf2hdt -index -rdftype ntriples $< $@
