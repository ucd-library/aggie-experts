#! /usr/bin/make
SHELL:=/bin/bash

# SIEGE parameters
concurrent:=32
reps:=16

# If you have siege install locally, you
# siege:=siege
# It's also possible to run siege as a docker file, if you don't want
# to get the binary.

# This directory is mounted in the docker container, so you can
d:=results

siege:=docker run -it --rm -v $$$$(pwd):/app ecliptik/docker-siege
INFO::
	@echo

urls:=search experts browse
mark:=one-es-save

# Check if host is defined
ifndef host
$(error host is not defined. Please provide the endpoint URL like: `make host=https://foo.com`)
endif

browse.tsv experts.tsv:
	for i in A B C D E F G H I J K L M N O P Q R S T U V W X Y Z; do \
		echo "$$i";\
	  echo -e "2\t/api/browse?p=$$i" >> browse.tsv; \
	  for e in $$(http ${host}/api/browse p==$$i page==1 size==1000 | jq -r '.hits[]["@id"]'); do \
	    echo -e "1\t/api/$$e" >> experts.tsv; \
	    done; \
	done;


define siege_test
$(warning siege_test,$1)

$1.txt:$1.tsv
	echo HOST=${host} > $$@
	while read -r n url; do \
	for i in $$$$(seq 1 $$$$n); do \
	    echo -e "$$$$RANDOM\t${host}/$$$$url"; \
	  done; \
	done < $$< | sort -n | head -200 | cut -f 2 >> $$@

siege::${d}/$1-${mark}.out

${d}/$1-${mark}.out:$1.txt
	[[ -d ${d} ]] || mkdir -p ${d}
	${siege} --concurrent=${concurrent} --reps=${reps} \
	  --mark=${mark} --log=/app/${d}/$1-${mark}.csv --file=/app/$1.txt -v | tee $$@

clean::
	rm -f ${d}/$1_log.csv ${d}/$1-${mark}.out $1.txt

endef


$(foreach u,${urls},$(eval $(call siege_test,$u)))
