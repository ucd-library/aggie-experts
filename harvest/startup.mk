#! /usr/bin/make -f
SHELL:=/bin/bash

mkfile_path := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: INFO

FUSEKI_BASE:=$(shell pwd)

# Modified from https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
INFO::
	@grep -E '^[.a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = "(INFO:)?:.*? +## *"}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}';\

.PHONY:bash server server_bg noop

INFO:: ## Server Commands

bash:  ## Run a bash shell in the container
	export FUSEKI_BASE="${FUSEKI_BASE}"; bash

noop:  ## Run a bash shell in the container
	export FUSEKI_BASE="${FUSEKI_BASE}"; bash -c 'tail -f /dev/null'

.PHONY: server_startup

server_startup:
	export FUSEKI_BASE=${FUSEKI_BASE};\
	. /fuseki-functions.sh; \
  cp -r /etc/fuseki/* ${FUSEKI_BASE}; \
	fix_startup_files;\

server:: server_startup ## Run the server
	${FUSEKI_HOME}/fuseki-server-hdt

server_bg: server_startup
	nohup ${FUSEKI_HOME}/fuseki-server-hdt &
