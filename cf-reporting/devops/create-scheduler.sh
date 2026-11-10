#!/usr/bin/env bash
# One-time: creates the Cloud Scheduler job that triggers the cf-reporting
# Cloud Run Job on the 1st of every month. Run after deploy-job.sh has
# deployed the Cloud Run Job at least once.
set -euo pipefail

PROJECT_ID="aggie-experts"
REGION="us-west1"
JOB_NAME="cf-reporting-export"
SCHEDULER_NAME="cf-reporting-monthly-export"
SCHEDULER_SA_EMAIL="cf-reporting-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# Cloud Run Jobs have no native HTTPS trigger, so Cloud Scheduler calls the
# Cloud Run Admin API's "run" endpoint directly, authenticated as the
# scheduler service account via an OIDC token (gcloud's --oauth-service-account-email).
gcloud scheduler jobs create http "${SCHEDULER_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 6 1 * *" \
  --time-zone="America/Los_Angeles" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
  --http-method=POST \
  --oauth-service-account-email="${SCHEDULER_SA_EMAIL}"
