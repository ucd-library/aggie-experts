#! /bin/bash

function init_local_user() {
  local uid=$(id -u)
  if [[ "$uid" = 0 ]]; then
    uid=${LOCAL_USER_ID:-9001}
    useradd --create-home --shell /bin/bash --uid ${uid} ucd.process
    export HOME=/home/ucd.process
    chown -R ucd.process:ucd.process /home/ucd.process
  fi
}
