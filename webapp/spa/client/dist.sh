#! /bin/bash

set -e
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $ROOT_DIR

rm -rf dist
mkdir dist

cp -r public/images dist/
cp -r public/fonts dist/
cp -r public/lib dist/
cp -r public/elements dist/
# cp -R -L public/loader dist/

cp public/index.html dist/
cp public/login.html dist/
cp public/manifest.json dist/

webpack --config webpack-dist.config.js
