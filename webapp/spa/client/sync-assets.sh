#! /bin/bash

GCS_BUCKET=${GCS_BUCKET:-aggie-experts-static-assets}

set -e 
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $ROOT_DIR

gsutil -m rsync -r ./static-assets gs://$GCS_BUCKET