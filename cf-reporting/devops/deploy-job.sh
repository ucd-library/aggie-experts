#!/usr/bin/env bash
# Deploys (or redeploys) the cf-reporting Cloud Run Job for a given image version.
# Run after a new image has been published, e.g.:
#   git tag cf-reporting-5.1.0 && git push origin cf-reporting-5.1.0
#   cork-kube build gcb -p aggie-experts -v 5.1.0
#   devops/deploy-job.sh 5.1.0
set -euo pipefail

VERSION="${1:?usage: deploy-job.sh <image-version>}"

PROJECT_ID="aggie-experts"
REGION="us-west1"
BUCKET="cf-reports"
JOB_NAME="cf-reporting-export"
JOB_SA_EMAIL="cf-reporting-job@${PROJECT_ID}.iam.gserviceaccount.com"
SECRET_NAME="cf-reporting-api-token"
IMAGE="us-west1-docker.pkg.dev/${PROJECT_ID}/pub/cf-reporting:${VERSION}"

# CF_ACCOUNT_ID, CF_ZONE_ID and CF_APP_NAME are not secret - fill in the real
# values for the zone being reported on before running this script.
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID in your shell before running this script}"
CF_ZONE_ID="${CF_ZONE_ID:?set CF_ZONE_ID in your shell before running this script}"
CF_APP_NAME="${CF_APP_NAME:-aggie-experts}"

gcloud run jobs deploy "${JOB_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --image="${IMAGE}" \
  --service-account="${JOB_SA_EMAIL}" \
  --set-env-vars="CF_ACCOUNT_ID=${CF_ACCOUNT_ID},CF_ZONE_ID=${CF_ZONE_ID},CF_APP_NAME=${CF_APP_NAME},AE_AF_GCS_BUCKET=${BUCKET},AE_AF_DEFAULT_DAYS=30" \
  --set-secrets="CF_API_TOKEN=${SECRET_NAME}:latest" \
  --max-retries=1 \
  --task-timeout=10m \
  --memory=512Mi \
  --cpu=1
