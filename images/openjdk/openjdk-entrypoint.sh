#! /bin/bash

. /openjdk-functions.sh

init_local_user

# Root is changed to LOCAL_USER_ID, other uids are run as themselves.
uid=$(id -u)
if [[ ${uid} = 0 ]]; then
  exec setpriv --reuid=ucd.process --init-groups "$@"
else
  exec "$@"
fi
