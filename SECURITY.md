# Security

This is an honest account of what's actually in place, not an aspirational
checklist — see `IMPLEMENTATION_PLAN.md` Phase 10 for how it was verified.

## Authentication & abuse prevention

- Passwords are hashed with bcrypt (`src/server/auth/password.ts`).
- Sessions are signed JWTs in an httpOnly cookie (`src/server/auth/session.ts`).
- **Per-account lockout** (Phase 1): 5 failed logins locks the account for
  15 minutes (`User.failedLoginAttempts`/`lockedUntil`).
- **Per-IP rate limiting** (Phase 10, `src/server/auth/rateLimit.ts`):
  20 login / 10 register attempts per IP per 15 minutes, backed by the
  `RateLimitAttempt` table — deliberately DB-backed rather than in-memory,
  since an in-memory counter resets per Cloud Run instance and would be
  trivially bypassed by hitting a different instance each request. This is
  defense in depth on top of the per-account lockout above, aimed at
  distributed guessing across many accounts and registration-spam.

## CSRF

No custom CSRF token machinery — Next.js's Server Actions (which is how
every mutation in this app is written; see `ARCHITECTURE.md`) check the
request's `Origin` against `Host`/`X-Forwarded-Host` and reject mismatches
by default. The two webhook routes (`/api/webhooks/stripe`,
`/api/webhooks/paypal`) are the exception that needs its own protection
since they're plain Route Handlers hit by a third party, not a Server
Action from our own UI — both verify the provider's cryptographic webhook
signature before processing (`src/server/payments/stripe.ts` /
`paypal.ts`'s `verifyWebhook`).

## HTTP security headers

Set globally via `next.config.ts`'s `headers()`:

- `Content-Security-Policy` — `default-src 'self'`, `img-src` additionally
  allows `https://storage.googleapis.com` (real product/category image
  URLs in production — see `src/server/storage/gcs.ts`) and `data:`.
  `script-src`/`style-src` include `'unsafe-inline'`, needed because Next.js
  emits inline hydration data and this app uses inline `style` attributes
  in a couple of places (e.g. homepage banner background images); verified
  against a real `next build && next start` with a Playwright console-error
  check across storefront and admin pages — zero CSP violations.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
  `Strict-Transport-Security` (only takes effect over HTTPS, which Cloud
  Run terminates at — harmless to send locally over HTTP).

If a future integration needs a new external origin (an analytics script,
a payment SDK's iframe, a CDN font), it needs an explicit CSP allowance —
don't widen `script-src`/`style-src` beyond what's actually used.

## Server Actions closure encryption

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be set to a stable value in
production (see `.env.example`, `DEPLOYMENT.md` §1.6/§4). Next.js encrypts
values captured in a Server Action's closure — and this app binds a lot of
them (`someAction.bind(null, id)` throughout the admin/seller UIs). Without
a stable key, Cloud Run's multiple instances each generate their own random
key at boot, so an action encrypted by one instance can fail to decrypt on
another under normal load-balanced traffic.

## Dependency audit

`npm audit` as of Phase 10:

- **Fixed**: `uuid` (moderate, via `gaxios` → `@google-cloud/storage`) —
  pinned to `^11.1.1` via a package.json `overrides` entry. Safe because
  `gaxios` only calls `uuid.v4()`, a stable API across the major bump.
- **Not fixed, deliberately**: `deepmerge-ts` (high), a transitive
  dependency of the `prisma` CLI's config loader (`@prisma/config`). The
  only automatic fix (`npm audit fix --force`) downgrades `prisma` to
  6.12.0 — a real breaking change this app can't take, since it depends on
  Prisma 7's driver-adapter architecture (`@prisma/adapter-pg`, no native
  engine binary — see `ARCHITECTURE.md` §2). This is a devDependency of the
  CLI (migrations, codegen, `prisma studio`), not of `@prisma/client` at
  runtime, so it isn't reachable by anything a request handles — the real
  exposure is a local `prisma migrate`/`prisma generate` invocation merging
  attacker-controlled recursive JSON, which isn't this app's threat model.
  Re-run `npm audit` periodically; this should be revisited once Prisma
  ships a fixed `@prisma/config` on the 7.x line.

## Logging & error visibility

See `DEPLOYMENT.md` §6 — structured JSON logs to stdout (ingested by Cloud
Logging automatically) plus `src/instrumentation.ts`'s `onRequestError`
hook for server-side errors and `error.tsx`/`global-error.tsx` boundaries
for client-side ones. No error-tracking SDK (e.g. Sentry) is wired up yet;
`SENTRY_DSN` in `.env.example` is a placeholder for when there's a real DSN
to send to.

## Secret rotation

Every secret lives in Secret Manager, referenced by Cloud Run via
`--set-secrets` (never baked into the image or committed — `.env` is
gitignored). To rotate one:

```bash
# Add a new version; Cloud Run picks it up on the next revision.
printf '%s' "$NEW_VALUE" | gcloud secrets versions add value-marka-session-secret --data-file=-
gcloud run services update value-marka --region=me-central1 --no-traffic  # or a full redeploy
```

Rotating `SESSION_SECRET` invalidates every existing session (users are
signed out) — expected, not a bug. Rotating
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` can cause in-flight Server Action
requests issued just before the rotation to fail once — acceptable for a
security rotation, not for routine redeploys (leave it alone otherwise).
Rotate database/provider credentials at the source (Cloud SQL user
password, Stripe/PayPal dashboard, SMTP/Twilio provider) first, then update
the corresponding secret version — never the other way around, or the old
credential stops working before the new one is live.
