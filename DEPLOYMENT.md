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

### 1.4b Private bucket for digital-product files

Digital products (P2.14) store their deliverable file separately from
catalog imagery, in a bucket with **no** public IAM binding — only ever
reachable through a short-lived v4 signed URL
(`src/server/storage/gcs.ts`'s `uploadPrivate`/`getSignedDownloadUrl`).
Do not add the `allUsers: objectViewer` binding used for the catalog
bucket above to this one, and do not point
`GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET` at the same bucket as
`GOOGLE_CLOUD_STORAGE_BUCKET` — with uniform bucket-level access, "public"
is a bucket-wide setting, so sharing a bucket would make digital-product
files publicly guessable too.

```bash
gcloud storage buckets create gs://value-marka-private \
  --location=me-central1 \
  --uniform-bucket-level-access
# No add-iam-policy-binding step here — this bucket stays private.
```

Grant the Cloud Run service account (created in §1.5) `roles/storage.objectAdmin`
on this bucket the same way §1.5 grants it on the public one, then set
`GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET=value-marka-private` alongside
`GOOGLE_CLOUD_STORAGE_BUCKET` in the Cloud Run env vars (§4). If this
variable is unset, uploading or downloading a digital-product file throws
rather than silently falling back to the public bucket.

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

# Required for multi-instance Cloud Run: without a stable key, a Server
# Action closure (e.g. any admin/seller `.bind(null, id)` action) encrypted
# by one instance can fail to decrypt on another — see .env.example.
openssl rand -base64 32 | gcloud secrets create value-marka-actions-encryption-key --data-file=-
```

Once you're ready to enable the features each of these gates (see
`.env.example` for the full list), the same pattern applies — create a
secret, then add it to `--set-secrets` in step 4:

```bash
# Payments (Phase 5) — Stripe Connect + PayPal
printf '%s' "$STRIPE_SECRET_KEY" | gcloud secrets create value-marka-stripe-secret-key --data-file=-
printf '%s' "$STRIPE_WEBHOOK_SECRET" | gcloud secrets create value-marka-stripe-webhook-secret --data-file=-
printf '%s' "$PAYPAL_CLIENT_SECRET" | gcloud secrets create value-marka-paypal-client-secret --data-file=-

# Email/SMS (Phase 7) — pick one email + one SMS provider
printf '%s' "$SMTP_PASSWORD" | gcloud secrets create value-marka-smtp-password --data-file=-
printf '%s' "$SMS_API_SECRET" | gcloud secrets create value-marka-sms-api-secret --data-file=-

# Abandoned-cart Cloud Scheduler job (Phase 7) — see section 4.3 below
openssl rand -base64 32 | gcloud secrets create value-marka-cron-secret --data-file=-
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
  --set-secrets="DATABASE_URL=value-marka-database-url:latest,SESSION_SECRET=value-marka-session-secret:latest,NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=value-marka-actions-encryption-key:latest" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=value-marka,GOOGLE_CLOUD_STORAGE_BUCKET=value-marka-uploads,GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET=value-marka-private,NODE_ENV=production" \
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

### 4.3 Cloud Scheduler for the abandoned-cart recovery job

`POST /api/cron/abandoned-carts` (`src/app/api/cron/abandoned-carts/route.ts`,
Phase 7) is written to be triggered by Cloud Scheduler, not a process
running inside the container — nothing calls it on its own:

```bash
gcloud scheduler jobs create http value-marka-abandoned-carts \
  --location=me-central1 \
  --schedule="0 */6 * * *" \
  --uri="https://<the-service-url>/api/cron/abandoned-carts" \
  --http-method=POST \
  --headers="Authorization=Bearer ${CRON_SECRET}"
```

Use the same `CRON_SECRET` value stored in `value-marka-cron-secret`
(section 1.6) — the route checks it and returns 401 otherwise. Adjust the
cron expression to taste; every 6 hours is a reasonable default for a
reminder email that shouldn't feel spammy.

## 5. Redeploying after future changes

Every subsequent push is just steps 2 and 4 again (skip 1, and skip 3
unless the schema changed — if it did, run `prisma migrate deploy` via the
proxy as in step 3 before redeploying):

```bash
gcloud builds submit --tag me-central1-docker.pkg.dev/value-marka/value-marka/app:latest
gcloud run deploy value-marka --image=me-central1-docker.pkg.dev/value-marka/value-marka/app:latest --region=me-central1
```

## 6. What this does set up as of Phase 10

- **Structured logging**: `src/server/logger.ts` writes JSON lines
  (`severity`/`message`/fields) to stdout/stderr; Cloud Run ingests
  container stdout as Cloud Logging automatically and promotes those
  fields — no logging SDK or extra credentials needed. Uncaught
  server-side errors are captured by `src/instrumentation.ts`'s
  `onRequestError` hook; uncaught client-side errors are logged from
  `src/app/[locale]/error.tsx` / `src/app/global-error.tsx`.
- **Security headers + CSP**: set via `next.config.ts` `headers()` — see
  `SECURITY.md` for the policy and how to extend it if a future
  integration needs a new external origin.
- **IP-scoped rate limiting** on login/register (`src/server/auth/rateLimit.ts`,
  DB-backed via the `RateLimitAttempt` table so it holds up across Cloud
  Run's multiple instances), layered on top of the existing per-account
  lockout from Phase 1.

## 7. What this does not set up yet

- **CI/CD**: deploys above are manual. A Cloud Build trigger on pushes to
  this branch (or `main`) is the natural next step — ask for it once
  you're happy driving deploys by hand a few times first.
- **Staging environment**: spec §11 calls for separate dev/staging/prod.
  This guide provisions one (production) environment; repeat section 1
  with a `-staging` suffix on every resource name for a second one.
- **Error-tracking SDK (e.g. Sentry)**: `.env.example` documents
  `SENTRY_DSN` as a placeholder — wiring `@sentry/nextjs` is a real,
  fairly small addition once there's an actual DSN to send to; until then,
  Cloud Logging (see above) is the honest, fully-functional baseline that
  doesn't depend on a credential this environment doesn't have.
- **Alerting**: Cloud Logging captures everything above, but nothing pages
  anyone yet — a log-based alerting policy on `severity>=ERROR` is a
  natural next step (`gcloud logging metrics create` +
  `gcloud alpha monitoring policies create`).

## 8. Cost note

At this stage (`db-g1-small` Cloud SQL always-on, Cloud Run scaling to
zero when idle), expect roughly $25–40/month, dominated by the always-on
Cloud SQL instance. `gcloud sql instances patch value-marka-db --tier=db-f1-micro`
is cheaper for pure testing, at the cost of very little headroom — do not
run production traffic on it.

## 9. Deploying to Vercel instead

Cloud Run (above) is this project's primary, fully-provisioned target, but
Vercel works too — `next.config.ts` and `src/server/db.ts` both special-case
it (see the comments there for why `output: "standalone"` and eager Prisma
client instantiation don't work on Vercel's build model).

1. **Connect a real Postgres database, not the Global Config Store.** In
   the Vercel dashboard, open the project's **Storage** tab and connect a
   Postgres-compatible provider — Neon, Supabase, or Vercel Postgres all
   work (this app connects via `@prisma/adapter-pg`, no engine binary, so
   any standard Postgres connection string is fine). The "Global Config
   Store" product (`@vercel/global-config`) is a *different* product — a
   small key-value store, not a relational database — and will not work
   here.
2. **Set `DATABASE_URL`** in Project Settings → Environment Variables to
   that database's real connection string (some integrations name their
   own var `POSTGRES_URL` or `POSTGRES_PRISMA_URL` instead — copy that
   value into `DATABASE_URL` if so, since that's the name this app reads).
3. **Set the other required env vars** from `.env.example` — at minimum
   `SESSION_SECRET` (32+ random characters) and
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, plus `NEXT_PUBLIC_APP_URL` and
   payment/email/SMS provider keys as needed. Unlike `DATABASE_URL`,
   nothing at build time checks these are set — `next build` succeeds
   without them, and the app only fails the first time a request actually
   needs one (session creation on login/register), as a real runtime
   error rather than a build failure. Use `/api/debug?secret=$CRON_SECRET`
   (see below) after deploying to confirm they're actually present before
   finding out from a user-facing error.
4. **Migrations run automatically on every Vercel deploy.** `package.json`
   defines a `vercel-build` script (Vercel prefers this over `build` when
   present) that runs `prisma migrate deploy` and the idempotent
   `prisma/seed.ts` — which seeds the permission catalog, system roles,
   language/currency/country reference data, and default homepage CMS
   blocks — before `next build`. A brand-new, empty database is expected
   and self-heals on first deploy; nothing extra to run by hand. (The
   Cloud Run path above still applies its own `prisma migrate deploy` once,
   manually, in section 3 — the Docker image build stage uses a dummy,
   unreachable `DATABASE_URL` on purpose, so it cannot run migrations
   itself.)
5. Redeploy after saving env vars — Vercel does not auto-redeploy on env
   var changes alone.

Background jobs (abandoned-cart recovery, Cloud Scheduler in section 4.3)
have no Vercel equivalent configured — either keep running them against a
Cloud Scheduler → this Vercel URL, or leave them disabled until needed.

### 9.1 Diagnosing a deployed instance without digging through platform logs

`GET /api/debug?secret=$CRON_SECRET` (reuses the same `CRON_SECRET` env var
`/api/cron/*` already trusts — no separate secret to manage) runs the real
DB connection, checks core tables are migrated, confirms a SUPER_ADMIN
exists, and round-trips a session token through the exact code path
login/register use — returning plain JSON with the real error message and
stack for whichever check fails. Built after exactly this kind of failure
(a missing `SESSION_SECRET` on Vercel) was hard to pin down from Vercel's
Runtime Logs UI alone: `next build` doesn't check these vars, so a
misconfiguration doesn't show up until a real user hits it as
`{"severity":"ERROR",...}` deep in a log stream. Point a browser at that
URL instead of hunting through logs.
