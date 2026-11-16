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
SECRET_NAMES=(CF_API_TOKEN CF_ACCOUNT_ID CF_ZONE_ID)

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

# The CF_API_TOKEN, CF_ACCOUNT_ID and CF_ZONE_ID secrets are created by hand in
# Secret Manager; this only grants the job read access to them.
echo "== Granting the job service account access to the Cloudflare secrets =="
for SECRET_NAME in "${SECRET_NAMES[@]}"; do
  gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${JOB_SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor"
done

echo "== Granting the scheduler service account permission to invoke Cloud Run jobs =="
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA_EMAIL}" \
  --role="roles/run.invoker"

echo "== Done. Next: deploy-job.sh <version>, then create-scheduler.sh =="
