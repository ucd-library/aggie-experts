#! /bin/bash

function init_local_user() {
  local uid=$(id -u)
  if [[ "$uid" = 0 ]]; then
    uid=${LOCAL_USER_ID:-9001}
    useradd --create-home --shell /bin/bash --uid ${uid} ucd.process
    export HOME=/home/ucd.process
    chown ucd.process:ucd.process /home/ucd.process /home/ucd.process/*
    chown -R ucd.process:ucd.process /home/ucd.process/configuration  /home/ucd.process/databases /home/ucd.process/logs /home/ucd.process/system  /home/ucd.process/system_files  /home/ucd.process/templates
  fi
}

function gcloud_auth() {
  if [[ -f /etc/fin/service-account.json ]]; then
    gcloud auth activate-service-account --key-file /etc/fin/service-account.json
  elif [[ -n ${GOOGLE_APPLICATION_CREDENTIALS_JSON} ]]; then
    gcloud auth activate-service-account --key-file=- <<< "${GOOGLE_APPLICATION_CREDENTIALS_JSON}"
  else
    echo "no /etc/fin/service-account.json and GOOGLE_APPLICATION_CREDENTIALS_JSON is not set"
  fi
}

init_local_user

uid=$(id -u)
if [[ ${uid} = 0 ]]; then
  # Don't cd, because users may want to set their own workdir
  if [[ -f /etc/fin/service-account.json ]]; then
    setpriv --reuid=ucd.process --init-groups gcloud auth activate-service-account --key-file=- < /etc/fin/service-account.json
  elif [[ -n ${GOOGLE_APPLICATION_CREDENTIALS_JSON} ]]; then
    setpriv --reuid=ucd.process --init-groups gcloud auth activate-service-account --key-file=- <<<${GOOGLE_APPLICATION_CREDENTIALS_JSON}
  else
    echo \"no /etc/fin/service-account.json and GOOGLE_APPLICATION_CREDENTIALS_JSON is not set\";
  fi;
  exec setpriv --reuid=ucd.process --init-groups -- make --file=/startup.mk "$@"

else
  exec make --file=/startup.mk "$@"
fi
