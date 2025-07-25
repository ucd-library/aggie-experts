#! /bin/bash

VERSION=$1
if [[ -z "$VERSION" ]]; then
  VERSION="anduin-node-etl"
fi

cork-kube build exec \
  -p fin \
  -v 2.12.0 \
  -o sandbox \
  -f fin-elastic-search

cork-kube build exec \
  -p aggie-experts \
  -v $VERSION \
  -o sandbox