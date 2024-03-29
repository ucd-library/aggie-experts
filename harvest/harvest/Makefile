#! /usr/bin/make -f
SHELL:=/bin/bash

mkfile_path := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

HDT:=import  ## variable: controls the source of the HDT files (import, stubs, build)

.PHONY: INFO

FUSEKI_BASE:=$(shell pwd)

# Modified from https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
INFO::
	@grep -E '^[.a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = "(INFO:)?:.*? +## *"}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}';\
	echo HDT:=${HDT};\
	echo GCS_GRAPH_STORAGE:=${GCS_GRAPH_STORAGE}

.PHONY:bash server server_bg noop

INFO:: ## Server Commands

bash:  ## Run a bash shell in the container
	export FUSEKI_BASE="${FUSEKI_BASE}"; bash

noop:  ## Run a bash shell in the container
	export FUSEKI_BASE="${FUSEKI_BASE}"; bash -c 'tail -f /dev/null'

.PHONY: server_startup

server_startup: ${FUSEKI_BASE}/databases/hdt/iam.hdt
	export FUSEKI_BASE=${FUSEKI_BASE};\
	. /fuseki-functions.sh; \
  cp -r /etc/fuseki/* ${FUSEKI_BASE}; \
	fix_startup_files;\

server:: server_startup ## Run the server
	${FUSEKI_HOME}/fuseki-server-hdt

server_bg: server_startup
	nohup ${FUSEKI_HOME}/fuseki-server-hdt &

#
# gcloud import/export
#
# USES GCS_GRAPH_STORAGE if set as env variable
GCS_GRAPH_STORAGE ?= gs://fuseki-db

hdt-bucket:=${GCS_GRAPH_STORAGE}

hdt-push: ## Push the HDT files to the GCS bucket
	gsutil rsync -r databases/hdt ${hdt-bucket}/hdt

hdt-pull: ## Pull HDT files from GCS_GRAPH_STORAGE
	[[ -d databases/hdt ]] || mkdir -p databases/hdt
	gsutil rsync -r ${hdt-bucket}/hdt databases/hdt

INFO:: ## When HDT=import
ifeq (${HDT},import)
.PHONY: iam.hdt

iam.hdt:${FUSEKI_BASE}/databases/hdt/iam.hdt ## Import iam.hdt file (HDT=import)

${FUSEKI_BASE}/databases/hdt/iam.hdt:${FUSEKI_BASE}/databases/hdt/%.hdt:
	[[ -d databases/hdt ]] || mkdir -p databases/hdt
	gsutil rsync -r ${hdt-bucket}/hdt/ databases/hdt/

endif

#
# Stub files
#
INFO:: ## When HDT=stubs
ifeq (${HDT},stubs)

define iam.stub
<http://experts.ucdavis.edu/private/iam/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://experts.ucdavis.edu/schema#Graph>.
endef

.PHONY: stubs iam.hdt

iam.hdt:${FUSEKI_BASE}/databases/hdt/iam.hdt ## Create Stub iam.hdt file (HDT=stubs)

stubs: ${FUSEKI_BASE}/databases/hdt/iam.hdt

INFO::
	@echo ${FUSEKI_BASE}/databases/hdt/iam.hdt:${FUSEKI_BASE}/databases/hdt/%.hdt:

${FUSEKI_BASE}/databases/hdt/iam.hdt:${FUSEKI_BASE}/databases/hdt/%.hdt:
	[[ -d $(dir $@) ]] || mkdir -p $(dir $@)
	rdf2hdt.sh -index $@ >/dev/null <<<'${$*.stub}'

endif

###########
# IAM Section
###########
ifeq (${HDT},build)

define tdb2hdt
.PHONY:$1.hdt
$1.hdt:${$1.tdb2} ${$1.hdt}

${$1.hdt}:${$1.tdb2}
	@[[ -d $(dir ${$1.hdt}) ]] || mkdir -p $(dir ${$1.hdt}); \
	rm -f ${$1.hdt}*;\
	tdb2.tdbdump --loc=${$1.tdb2} | grep '<$2> \.$$$$' | rdf2hdt.sh -rdftype nquad -index -  ${$1.hdt}

endef

iam.tdb2:=databases/iam
iam.hdt:=${FUSEKI_BASE}/databases/hdt/iam.hdt

define ucdid_auth
$$(gcloud --project=aggie-experts secrets versions access latest --secret=ucdid_auth | jq -r '.[] | select(.["@id"]=="iet-ws") | .auth.raw_auth')
endef

.PHONY: iam.hdt
iam.hdt:${iam.hdt} ## BUILD iam.hdt from IAM data file (HDT=build)

iam/staff.in.jsonld:
	@[[ -d iam ]] || mkdir iam;\
	ucdid --auth="$(call ucdid_auth)" fetch --format=jsonld --search=isStaff=true profiles > $@

iam/faculty.in.jsonld:
	@[[ -d iam ]] || mkdir iam;
	ucdid --auth="$(call ucdid_auth)" fetch --format=jsonld --search=isFaculty=true profiles > $@

iam/faculty.jsonld iam/staff.jsonld:%.jsonld:%.in.jsonld ${mkfile_path}/iam/rq/experts.rq
	arq --query=${mkfile_path}/iam/rq/experts.rq --results=jsonld --data=$*.in.jsonld |\
	jq '. + {"@id":"ark:/87287/d7c08j/"}' > $@

${iam.tdb2}:files:=iam/faculty.jsonld iam/staff.jsonld
${iam.tdb2}:iam/faculty.jsonld iam/staff.jsonld
	rm -rf ${iam.tdb2}; mkdir -p ${iam.tdb2}
	tdb2.tdbloader --loc=${iam.tdb2} ${files}

iam.json.gz:${iam.tdb2}
	tdb2.tdbdump --loc=${iam.tdb2} --output=jsonld | gzip > $@

$(eval $(call tdb2hdt,iam,ark:/87287/d7c08j/))
 endif

##
# Person fetching
##

#$(gcloud secrets versions access latest --secret=cdl_elements_json | jq -r '.[] | select(.["@id"]=="oapolicy") | .auth.raw_auth')
