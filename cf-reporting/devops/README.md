# cf-reporting devops

Runs the Cloudflare analytics export as a **Google Cloud Run Job** on a monthly
**Cloud Scheduler** trigger, writing the zipped CSV export to the `cf-reports`
GCS bucket in the `aggie-experts` project.

This is intentionally serverless rather than following the kustomize/
`aggie-experts-deployment` pattern used by the rest of Aggie Experts: it's a
once-a-month batch task with no need for an always-on cluster workload, so a
Cloud Run Job + Cloud Scheduler pair is a better fit than a k8s Deployment.

All scripts use plain `gcloud` (no Terraform), matching this project's
existing convention of managing GCP resources imperatively.

## One-time setup

1. Build and push the image (adds `cf-reporting` to the existing release flow
   via the repo-root `.cork-build` entry):
   ```bash
   git tag cf-reporting-0.1.0 && git push origin cf-reporting-0.1.0
   cork-kube build gcb -p aggie-experts -v 0.1.0
   ```
2. `./setup.sh` - creates the two service accounts, grants the job's service
   account write access to `gs://cf-reports`, creates the
   `cf-reporting-api-token` Secret Manager secret (you'll be prompted to paste
   the real Cloudflare API token value), and grants the scheduler's service
   account permission to invoke Cloud Run jobs.
3. `CF_ACCOUNT_ID=... CF_ZONE_ID=... ./deploy-job.sh 0.1.0` - deploys the
   Cloud Run Job itself.
4. `./create-scheduler.sh` - creates the Cloud Scheduler job that fires on the
   1st of every month at 6am Pacific.
5. Verify end-to-end before waiting for the real monthly firing:
   ```bash
   gcloud scheduler jobs run cf-reporting-monthly-export --location=us-west1 --project=aggie-experts
   ```
   then confirm a new zip appears in `gs://cf-reports/`.

## Redeploying a new image version

Whenever `cf-reporting` changes:
```bash
git tag cf-reporting-0.2.0 && git push origin cf-reporting-0.2.0
cork-kube build gcb -p aggie-experts -v 0.2.0
CF_ACCOUNT_ID=... CF_ZONE_ID=... ./deploy-job.sh 0.2.0
```
`setup.sh` and `create-scheduler.sh` only need to run once; `deploy-job.sh`
reruns on every version bump.

## Manually running the job

```bash
gcloud run jobs execute cf-reporting-export --region=us-west1 --project=aggie-experts
```
