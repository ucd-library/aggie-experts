#! /usr/bin/make -f
SH:=/bin/bash

academic_titles:=academic_titles.txt

define context
{"@context": {\
"@vocab": "http://schema.org/",\
"@base": "http://experts.library.ucdavis.edu/",\
"cto": "http://experts.library.ucdavis.edu/cto/",\
"title": "http://experts.library.ucdavis.edu/title/"\
}\
}
endef

info::
	@echo '${context}'

cto_codes.jsonld: ${academic_titles}
	sed -e 's/ \(00\|CWR\).*//' $< | sort -u |\
	sed -e 's/\([^ ]*\) \(.*\)/{"@id":"\1","name":"\2"}/' |\
	jq --slurp '${context} + {"@graph":.}' > $@

title_codes.jsonld: ${academic_titles}
	sed -e 's/^\(...\).* \(......\) \(.*\)/{"cto":"cto:\1","@id":"\2", "name":"\3"}/' $< |\
	jq --slurp '${context} + {"@graph":.}' > $@
