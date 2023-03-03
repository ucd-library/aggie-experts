#! /bin/bash

. /openjdk-functions.sh

init_local_user

# Startup the server if needed
#if ( ${RP_GRANTS_SERVER} ) ;  then
#  fix_startup_files;
#  start_fuseki ;
#  wait-for-it -t 5 localhost:3030 -- echo "fuseki is up";
#fi

uid=$(id -u)
if [[ ${uid} = 0 ]]; then
  # Don't cd, because users may want to set their own workdir
  exec setpriv --reuid=ucd.process --init-groups make --file=/usr/local/lib/grants/Makefile "$@"
#  exec /jena-fuseki-hdt-entrypoint.sh setpriv --reuid=ucd.process --init-groups make --file=/usr/local/lib/grants/Makefile "$@"
else
  exec make --file=/usr/local/lib/grants/Makefile "$@"
#  exec /jena-fuseki-hdt-entrypoint.sh make --file=/usr/local/lib/grants/Makefile "$@"
fi
