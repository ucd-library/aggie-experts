#!/usr/bin/env bash
# One-time setup for the cf-reporting Cloud Run Job + Cloud Scheduler.
# Run manually (not via CI). Safe to re-run; gcloud create/add-iam-policy-binding
# commands are idempotent (create will error "already exists" harmlessly).
set -euo pipefail

PROJECT_ID="aggie-experts"
REGION="us-west1"
BUCKET="cf-reports"
JOB_SA="cf-reporting-job"
JOB_SA_EMAIL="${JOB_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SA="cf-reporting-scheduler"
SCHEDULER_SA_EMAIL="${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
SECRET_NAME="cf-reporting-api-token"

echo "== Creating service accounts =="
gcloud iam service-accounts create "${JOB_SA}" \
  --project="${PROJECT_ID}" \
  --display-name="cf-reporting Cloud Run Job runtime"

gcloud iam service-accounts create "${SCHEDULER_SA}" \
  --project="${PROJECT_ID}" \
  --display-name="cf-reporting Cloud Scheduler invoker"

echo "== Granting the job service account write access to gs://${BUCKET} =="
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${JOB_SA_EMAIL}" \
  --role="roles/storage.objectCreator"

echo "== Creating the Cloudflare API token secret =="
echo "You will be prompted to paste the CF_API_TOKEN value (input is not echoed)."
gcloud secrets create "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --replication-policy="automatic"

read -r -s -p "CF_API_TOKEN value: " CF_API_TOKEN_VALUE
echo
printf '%s' "${CF_API_TOKEN_VALUE}" | gcloud secrets versions add "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --data-file=-
unset CF_API_TOKEN_VALUE

echo "== Granting the job service account access to the secret =="
gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${JOB_SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

echo "== Granting the scheduler service account permission to invoke Cloud Run jobs =="
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA_EMAIL}" \
  --role="roles/run.invoker"

echo "== Done. Next: deploy-job.sh <version>, then create-scheduler.sh =="
