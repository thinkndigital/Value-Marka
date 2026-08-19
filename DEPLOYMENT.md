# Deploying Value Marka to Google Cloud

This deploys the current build (Phases 1–2: auth, RBAC, catalog, sellers,
products, inventory) to Cloud Run against a real Cloud SQL Postgres
database and a real Cloud Storage bucket — no shortcuts, same code path as
local dev. There is no payments/CMS/checkout yet (see
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)); this gets the
foundation live so later phases ship straight to production as they land.

Target project: **`value-marka`**. Commands below assume that project id —
adjust if yours differs. Region used throughout: **`me-central1`** (Doha —
closest GCP region to the Jordan/Gulf launch markets); swap every
`me-central1` for your preferred region if you'd rather use another one.
Not every GCP service is available in every region — if a command below
fails with a region/availability error, run the equivalent
`gcloud <service> locations list` (or check the Cloud Console) and pick a
supported region, then use that same region consistently in every command
below instead.

## 0. Prerequisites

- The [`gcloud` CLI](https://cloud.google.com/sdk/docs/install), authenticated
  with an account that has Owner/Editor on the `value-marka` project:
  ```bash
  gcloud auth login
  gcloud config set project value-marka
  ```
- Billing enabled on the project (Cloud Run, Cloud SQL, and Cloud Build all
  require it).

Everything below can be run from your machine or from **Cloud Shell**
(`console.cloud.google.com` → the `>_` icon) — Cloud Shell already has
`gcloud` installed and authenticated as you, which is the easiest path if
you don't want to install anything locally.

## 1. One-time project setup

### 1.1 Enable the APIs this stack needs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com
```

### 1.2 Artifact Registry (holds the built Docker image)

```bash
gcloud artifacts repositories create value-marka \
  --repository-format=docker \
  --location=me-central1 \
  --description="Value Marka container images"
```

### 1.3 Cloud SQL for PostgreSQL

```bash
gcloud sql instances create value-marka-db \
  --database-version=POSTGRES_16 \
  --region=me-central1 \
  --tier=db-g1-small \
  --storage-size=10GB \
  --storage-auto-increase

# Generate and store a strong password instead of typing one:
DB_PASSWORD=$(openssl rand -base64 24)
echo "Save this DB password somewhere safe: $DB_PASSWORD"

gcloud sql users create valuemarka_app \
  --instance=value-marka-db \
  --password="$DB_PASSWORD"

gcloud sql databases create valuemarka \
  --instance=value-marka-db
```

`db-g1-small` is a reasonable starting tier for this stage — resize later
with `gcloud sql instances patch value-marka-db --tier=...` as real traffic
shows up. If `gcloud` rejects that tier name (Cloud SQL's tier catalog
changes over time), run `gcloud sql tiers list` and pick a current
small/shared-core one.

### 1.4 Cloud Storage bucket for product/category/brand images

Bucket names are globally unique across all of GCS — if `value-marka-uploads`
is taken, pick another (e.g. append your project number).

```bash
gcloud storage buckets create gs://value-marka-uploads \
  --location=me-central1 \
  --uniform-bucket-level-access

# Product imagery is public-read by design (src/server/storage/gcs.ts) —
# same pattern every marketplace uses for catalog images.
gcloud storage buckets add-iam-policy-binding gs://value-marka-uploads \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

### 1.5 Service account for the running Cloud Run service

```bash
gcloud iam service-accounts create value-marka-run \
  --display-name="Value Marka Cloud Run runtime"

RUN_SA="value-marka-run@value-marka.iam.gserviceaccount.com"

# Let it write uploaded images to the bucket:
gcloud storage buckets add-iam-policy-binding gs://value-marka-uploads \
  --member="serviceAccount:$RUN_SA" \
  --role=roles/storage.objectAdmin

# Let it open a Cloud SQL connection:
gcloud projects add-iam-policy-binding value-marka \
  --member="serviceAccount:$RUN_SA" \
  --role=roles/cloudsql.client

# Let it read the secrets created in the next step:
gcloud projects add-iam-policy-binding value-marka \
  --member="serviceAccount:$RUN_SA" \
  --role=roles/secretmanager.secretAccessor
```

### 1.6 Secrets

Cloud Run connects to Cloud SQL over a Unix socket it mounts automatically
(`--add-cloudsql-instances`, wired up in step 3) — that's what the
`/cloudsql/...` host below refers to.

```bash
INSTANCE_CONNECTION_NAME="value-marka:me-central1:value-marka-db"

printf 'postgresql://valuemarka_app:%s@localhost/valuemarka?host=/cloudsql/%s' \
  "$DB_PASSWORD" "$INSTANCE_CONNECTION_NAME" \
  | gcloud secrets create value-marka-database-url --data-file=-

openssl rand -base64 32 | gcloud secrets create value-marka-session-secret --data-file=-
```

## 2. Build the image

From the repository root (where the `Dockerfile` is):

```bash
gcloud builds submit \
  --tag me-central1-docker.pkg.dev/value-marka/value-marka/app:latest
```

This builds in Cloud Build (not on your machine) using the multi-stage
`Dockerfile` — Next.js's `output: "standalone"` build, Prisma's client
generated for the driver-adapter runtime (no native engine binary to worry
about across platforms; see the note in `ARCHITECTURE.md` §2). Expect a
few minutes the first time.

## 3. Run the database migration + seed once

The running service should never run `prisma migrate` itself — do it once,
out of band, via the Cloud SQL Auth Proxy:

```bash
# Cloud Shell already has this; locally: https://cloud.google.com/sql/docs/postgres/sql-proxy
cloud-sql-proxy value-marka:me-central1:value-marka-db --port 5433 &

export DATABASE_URL="postgresql://valuemarka_app:${DB_PASSWORD}@127.0.0.1:5433/valuemarka"
npx prisma migrate deploy  # applies prisma/migrations, non-interactively
npm run db:seed            # roles, permissions, languages, currencies, countries

kill %1  # stop the proxy
```

Always use `prisma migrate deploy` against this database, never
`prisma migrate dev` (that's `npm run db:migrate`, for local development
only) — `migrate dev` can prompt to reset the database on drift, which is
never acceptable against production data, even on a fresh instance.

## 4. Deploy to Cloud Run

```bash
gcloud run deploy value-marka \
  --image=me-central1-docker.pkg.dev/value-marka/value-marka/app:latest \
  --region=me-central1 \
  --platform=managed \
  --service-account=value-marka-run@value-marka.iam.gserviceaccount.com \
  --add-cloudsql-instances=value-marka:me-central1:value-marka-db \
  --set-secrets="DATABASE_URL=value-marka-database-url:latest,SESSION_SECRET=value-marka-session-secret:latest" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=value-marka,GOOGLE_CLOUD_STORAGE_BUCKET=value-marka-uploads,NODE_ENV=production" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=4
```

`gcloud` prints the service URL when this finishes
(`https://value-marka-xxxxxxxx-uc.a.run.app` or similar). Open it — you
should see the Value Marka homepage.

### 4.1 Point NEXT_PUBLIC_APP_URL at the real URL

The URL isn't known until after the first deploy, so set it now (or once
you've mapped a custom domain — see below):

```bash
gcloud run services update value-marka \
  --region=me-central1 \
  --set-env-vars="NEXT_PUBLIC_APP_URL=https://<the-url-from-above>"
```

### 4.2 (Optional) Custom domain

```bash
gcloud beta run domain-mappings create \
  --service=value-marka \
  --domain=your-domain.com \
  --region=me-central1
```
Follow the DNS records it prints, then repeat step 4.1 with the real domain.

## 5. Redeploying after future changes

Every subsequent push is just steps 2 and 4 again (skip 1, and skip 3
unless the schema changed — if it did, run `prisma migrate deploy` via the
proxy as in step 3 before redeploying):

```bash
gcloud builds submit --tag me-central1-docker.pkg.dev/value-marka/value-marka/app:latest
gcloud run deploy value-marka --image=me-central1-docker.pkg.dev/value-marka/value-marka/app:latest --region=me-central1
```

## 6. What this does not set up yet

- **CI/CD**: deploys above are manual. A Cloud Build trigger on pushes to
  this branch (or `main`) is the natural next step — ask for it once
  you're happy driving deploys by hand a few times first.
- **Staging environment**: spec §11 calls for separate dev/staging/prod.
  This guide provisions one (production) environment; repeat section 1
  with a `-staging` suffix on every resource name for a second one.
- **Email/SMS/payment provider secrets**: not needed yet — nothing in
  Phases 1–2 sends email/SMS or takes a payment. `.env.example` documents
  the variables those integrations will need once their phases land.
- **Monitoring/alerting**: Cloud Run ships basic request/error metrics and
  logs to Cloud Logging automatically; nothing custom is wired up (that's
  Phase 10).

## 7. Cost note

At this stage (`db-g1-small` Cloud SQL always-on, Cloud Run scaling to
zero when idle), expect roughly $25–40/month, dominated by the always-on
Cloud SQL instance. `gcloud sql instances patch value-marka-db --tier=db-f1-micro`
is cheaper for pure testing, at the cost of very little headroom — do not
run production traffic on it.
