#! /bin/bash

# Get init_local_user
. /openjdk-functions.sh

init_local_user

uid=$(id -u)
if [[ ${uid} = 0 ]]; then
  # Don't cd, because users may want to set their own workdir
  exec setpriv --reuid=ucd.process --init-groups make --file=/usr/local/lib/harvest/harvest.mk "$@"
else
  exec make --file=/usr/local/lib/harvest/harvest.mk "$@"
fi
