#! /bin/bash

set -e

/docker-run.sh

TOKEN=$(LOG_LEVEL=error node /service/getToken.js)

FCREPO_HOST=http://gateway:3001 \
FCREPO_JWT=$TOKEN \
  fin io import \
  --import-from-root \
  --fcrepo-path-type=subpath \
  /etc/ucdlib-service-init/fcrepo-aggie-experts
