#! /bin/bash

# Get init_local_user
. /openjdk-functions.sh

init_local_user

function gcloud_auth() {
  if [[ -n ${GOOGLE_APPLICATION_CREDENTIALS_JSON} ]]; then
    gcloud auth activate-service-account --key-file=- <<< "${GOOGLE_APPLICATION_CREDENTIALS_JSON}"
  else
    echo "GOOGLE_APPLICATION_CREDENTIALS_JSON is not set"
  fi
}

uid=$(id -u)
if [[ ${uid} = 0 ]]; then
  # Don't cd, because users may want to set their own workdir
  setpriv --reuid=ucd.process --init-groups -- bash -c 'gcloud auth activate-service-account --project=digital-ucdavis-edu --key-file=- <<< "${GOOGLE_APPLICATION_CREDENTIALS_JSON}"'
  exec setpriv --reuid=ucd.process --init-groups make --file=/usr/local/lib/harvest/Makefile "$@"
else
  exec make --file=/usr/local/lib/harvest/Makefile "$@"
fi
