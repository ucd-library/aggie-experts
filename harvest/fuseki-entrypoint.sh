#! /bin/bash

function gcloud_auth() {
  if [[ -f /etc/fin/service-account.json ]]; then
    gcloud auth activate-service-account --key-file /etc/fin/service-account.json
  elif [[ -n ${GOOGLE_APPLICATION_CREDENTIALS_JSON} ]]; then
    gcloud auth activate-service-account --key-file=- <<< "${GOOGLE_APPLICATION_CREDENTIALS_JSON}"
  else
    echo "no /etc/fin/service-account.json and GOOGLE_APPLICATION_CREDENTIALS_JSON is not set"
  fi
}

# This is a replication of the original fuseki.sh script, but with a check for
# the existence of the service account file
gcloud_auth
. /fuseki-functions.sh
fix_startup_files

# Use Dockerfile's CMD as the default command
exec "$@"
