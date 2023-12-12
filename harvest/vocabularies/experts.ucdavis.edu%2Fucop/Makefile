#! /usr/bin/make -f
SH:=/bin/bash

academic_titles:=academic_titles.txt

define cto_context
{"@context": {"@vocab": "http://schema.org/","@base": "http://experts.ucdavis.edu/cto/"}}
endef

define pos_context
{"@context": {\
"@vocab": "http://schema.org/",\
"@base": "http://experts.ucdavis.edu/position/",\
"c": "http://experts.ucdavis.edu/cto/",\
"cto": { "@type":"@id","@id":"http://schema.library.ucdavis.edu/schema#cto"}\
}}
endef

info::
	@echo '${context}'

cto_codes.jsonld: ${academic_titles}
	sed -e 's/ \(00\|CWR\).*//' $< | sort -u |\
	sed -e 's/\([^ ]*\) \(.*\)/{"@id":"\1","name":"\2"}/' |\
	jq --slurp '${cto_context} + {"@graph":.}' > $@

pos_codes.jsonld: ${academic_titles}
	sed -e 's/^\(...\).* \([0-9C][0-9W][0-9R]..[0-9]\) \(.*\)/{"cto":"c:\1","@id":"\2", "name":"\3"}/' $< |\
	jq --slurp '${pos_context} + {"@graph":.}' > $@

ucd_titles.jsonld:
	ucdid fetch --format=jsonld pps.titles > $@

http:=http --auth=admin:testing123
db:=http://localhost:3030
dbName:=position

upload:cto_codes.jsonld pos_codes.jsonld
	${http} DELETE ${db}/$$/datasets/${dbName}
	${http} POST ${db}/$$/datasets dbType==tdb dbName==${dbName}
	${http} POST ${db}/${dbName}/data Content-type:application/ld+json < cto_codes.jsonld
	${http} POST ${db}/${dbName}/data Content-type:application/ld+json < pos_codes.jsonld

positions.n3:
	${http} POST ${db}/${dbName}/query Content-type:application/sparql-query Accept:text/n3 < positions.rq
