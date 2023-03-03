#!/bin/bash

. /fuseki-functions.sh

fix_startup_files

# For the jena, we will let the CMD start the server.  Other setups can start the server in the backend.
exec "$@"
