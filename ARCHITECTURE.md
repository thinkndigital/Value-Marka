# Value Marka — Architecture

This document is the source of truth for how Value Marka is built. It is written
before feature code so that every phase of the [Implementation Plan](./IMPLEMENTATION_PLAN.md)
builds on the same foundation instead of inventing new patterns per feature.

## 1. Product shape

Value Marka is a multi-vendor marketplace with four ecosystems that share one
database and one set of domain services, but have separate UIs and separate
authorization boundaries:

- **Customer** storefront (`/[locale]/...`)
- **Seller** dashboard (`/[locale]/seller/...`)
- **Admin** control center (`/[locale]/admin/...`)
- **Affiliate** portal (`/[locale]/affiliate/...`)

A single `User` can hold multiple roles (e.g. a person can be a Customer and an
Affiliate). Sellers and Admin staff are modeled as role-scoped profiles attached
to a `User`, never as a separate identity system — this is what lets one login
serve every surface while RBAC decides what each surface may render or mutate.

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Application framework | Next.js 16 (App Router), React 19, TypeScript | Server Components let us keep business logic off the client by default; Route Handlers give us a real API surface a future mobile app can call; one deploy artifact for storefront + dashboards. |
| Styling / design system | Tailwind CSS v4 (`@theme` tokens) + hand-built primitives | Tokens are generated from the existing Value Marka brand (navy/yellow, Cairo/Tajawal) rather than a generic shadcn/purple-gradient look. No component library that fights the brand. |
| Database | PostgreSQL | Only viable choice for money-safe (`NUMERIC`/`DECIMAL`), relational, multi-tenant data with strong FK/constraint guarantees. Maps to Cloud SQL for Postgres on GCP. |
| ORM | Prisma | Typed schema is also living documentation (see `prisma/schema.prisma`), migrations are reviewable, `Prisma.Decimal` avoids float money bugs. |
| Auth | Custom, following the officially documented Next.js pattern (DB-backed sessions, `jose`-signed cookie, `bcryptjs` password hashing) | A marketplace needs custom claims (active role, seller/affiliate id, permission set) that off-the-shelf providers make awkward, and we need zero vendor lock-in for a platform this central. RBAC is first-class, not bolted on. |
| Validation | Zod | Same schema drives server-action validation and (later) OpenAPI generation for the mobile-app-facing API. |
| i18n | `next-intl` | Full App Router support, per-locale routing (`/en/...`, `/ar/...`), RTL-aware, supports the CMS-managed translation requirement in Phase 8. |
| Background jobs | Queue abstraction (`src/server/jobs/queue.ts`) over Cloud Tasks in production, in-process fallback in dev | Emails, webhooks, payouts, affiliate attribution must never block a request. Defined now as an interface so Phase 5+ features implement against it instead of ad hoc `setTimeout`/fire-and-forget. |
| File storage | Storage abstraction (`src/server/storage/`) over Google Cloud Storage | Product images/videos are never DB blobs. Local-disk adapter only for `next dev` without GCS credentials. |
| Payments | Provider abstraction (`src/server/payments/`) with Stripe Connect + PayPal adapters | Marketplace payment splitting (commission + seller payout) is provider-specific; the domain layer (order, ledger) must not know which provider was used. |
| Email / SMS | Provider abstraction (`src/server/notifications/`) | Swappable (SMTP/Resend/SendGrid/Mailgun, Twilio/MessageBird) via env config, never hardcoded. |
| Search | Repository interface today, Meilisearch/Algolia adapter later | Product search starts on Postgres (`ILIKE`/trigram index), swappable without touching UI. |
| Deployment | Google Cloud Run (app) + Cloud SQL (Postgres) + Cloud Storage (assets) + Secret Manager (secrets) | Matches spec §51. `development` / `staging` / `production` are separate Cloud Run services + separate Cloud SQL databases, never separate code paths. |

## 3. Layering rules

```
UI (Server/Client Components)
   │  never contains business logic, only calls services + renders
   ▼
Server Actions / Route Handlers   (src/app/**/actions.ts, src/app/api/**/route.ts)
   │  auth + input validation (zod) + calls services, never queries Prisma directly
   ▼
Domain services   (src/server/services/*.ts)
   │  business logic: pricing, commission, inventory movement, ledger posting
   ▼
Data access   (Prisma Client, src/server/db.ts)
   │
   ▼
PostgreSQL
```

Rules enforced by convention and code review (and progressively by lint
boundaries as the codebase grows):

1. **No business logic in components.** A React component may call a server
   action or read a DTO; it may not compute commission, tax, or inventory
   deltas itself.
2. **Money is server-side only.** The client never sends a total; every
   checkout/payment/refund total is recomputed server-side from current DB
   state (spec §26). All money fields are `Prisma.Decimal`, never `number`.
3. **All state-changing financial operations go through the ledger.**
   Services never `UPDATE` a balance column directly — they insert immutable
   `LedgerEntry` rows and balances are derived (spec §32).
4. **All inventory changes go through `InventoryMovement`.** No service is
   allowed to write `Inventory.quantity` directly (spec §11).
5. **Every service that touches another seller's data takes an explicit
   `sellerId` scope and enforces it in the `WHERE` clause.** There is no
   "trust the frontend didn't ask for someone else's data" — see §5 below.
6. **Every sensitive mutation writes an `AuditLog` row** (who, what, entity,
   before/after, when) — spec §36.

## 4. Multi-tenant order model

A cart can span multiple sellers. Checkout creates one `Order` (customer-facing,
one payment) and N `SellerOrder` rows (one per seller in the cart), each holding
its own `OrderItem`s, its own shipping/fulfillment status, and its own financial
allocation (revenue, commission, payment-fee share, payout amount). Admin reads
`Order` + all `SellerOrder`s; a seller's dashboard queries only its own
`SellerOrder`s. See `DATABASE.md` §Orders for the full shape and the allocation
algorithm (pro-rata by line-item subtotal).

## 5. Seller data isolation

This is the marketplace's core trust boundary and is treated as a security
control, not a UI convenience:

- Every seller-owned table (`Product`, `SellerOrder`, `Payout`, `Expense`, …)
  carries a non-nullable `sellerId`.
- Seller-surface server actions/route handlers resolve `sellerId` from the
  authenticated session (`getActiveSellerId()`), **never** from a client-supplied
  parameter, and every query is scoped `WHERE sellerId = :sellerId`.
- A shared `assertSellerOwns(entity, sellerId)` guard is used before any
  mutation on an entity looked up by id, closing the "guess another seller's
  order id" gap.
- Admin-surface actions require an explicit elevated permission
  (`orders.read.any`, `finance.read.any`, …) distinct from the seller-scoped
  permission, so a bug can't silently grant cross-tenant access by omission.
- This is covered by the isolation tests in Phase 1 (`tests/rbac`) and must
  gain a dedicated integration test per feature in later phases (spec §62).

## 6. RBAC model

`Role` ⟷ `Permission` is many-to-many via `RolePermission`; `User` ⟷ `Role` is
many-to-many via `UserRole` (a user can be Customer + Affiliate at once, or
Seller + Seller staff with a narrower role). Permissions are strings in the
`resource.action[.scope]` shape (`products.read`, `orders.refund`,
`finance.read.any`). `requirePermission(session, "orders.refund")` is the single
server-side gate — UI-level hiding of a button is a UX nicety, never the
authorization boundary (see the Next.js auth guide's warning against
"return null and call it secure", which this codebase follows literally).

The seed roles (`prisma/seed.ts`) match spec §34: `SUPER_ADMIN`, `ADMIN`,
`FINANCE`, `MARKETING`, `CUSTOMER_SUPPORT`, `INVENTORY_MANAGER`,
`SELLER_MANAGER`, `CONTENT_MANAGER`, `ANALYST`, `SELLER`, `AFFILIATE`,
`CUSTOMER`.

## 7. i18n / RTL

- Locale is a URL segment: `/en/...`, `/ar/...`. `next-intl` resolves messages
  and text direction per request.
- `ar` renders `<html dir="rtl" lang="ar">`; layout, spacing, and icon mirroring
  use CSS logical properties (`ms-*`/`me-*`, `text-start`/`text-end`) rather than
  fixed `left`/`right` utilities, so components don't need an RTL-specific fork.
- Fonts: `Cairo` (display/headings) and `Tajawal` (body) — chosen because both
  ship full Arabic + Latin glyph sets with matching weights, so headings and
  body text look intentional in both languages instead of Arabic being a
  mechanically-translated afterthought (spec §6).
- Translatable content that lives in the database (category names, CMS blocks,
  product titles) uses a sibling `*Translation` table keyed by
  `(entityId, locale)` rather than fixed `nameEn`/`nameAr` columns, so adding a
  language later is a data change, not a migration (spec §6, §46 `Translation`).

## 8. Multi-country / multi-currency

`Country` and `Currency` are database tables, seeded with the launch set
(Jordan, Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman, Egypt + USD/EUR/GBP
for cross-border display), never hardcoded in application code. Every money
column stores `(amount, currencyCode)`; cross-currency display goes through
`ExchangeRate` snapshots stored on the transaction (spec §8) so historical
orders don't re-price when today's rate changes. All arithmetic uses
`Prisma.Decimal` / `decimal.js` — floating point is never used for money.

## 9. Payments architecture

`src/server/payments/PaymentProvider.ts` defines the adapter interface
(`createIntent`, `capture`, `refund`, `onboardSeller`, `verifyWebhook`, …).
`stripe.ts` implements it with Stripe Connect (destination charges +
`application_fee_amount` for commission, per Stripe's current marketplace
guidance) and `paypal.ts` implements it with PayPal's current REST APIs.
Checkout/refund/payout services call the interface, never a provider SDK
directly, so HyperPay/Moyasar/Tap can be added later as pure adapters.
Webhook routes verify signatures, persist the raw event to `WebhookEvent`
before processing (idempotency + replay), and hand off processing to a
background job (spec §30).

## 10. Background jobs

`src/server/jobs/queue.ts` exports `enqueue(jobName, payload)` and a job
registry. In production this is backed by Cloud Tasks invoking a Route
Handler; in `next dev` without Cloud Tasks configured it falls back to an
in-process `setImmediate` runner so local development doesn't require GCP
credentials. No feature is allowed to do real work (send an email, call a
webhook, recompute affiliate commission) synchronously inside a request.

## 11. Environments

`development` (local, or a preview Cloud Run revision), `staging`, and
`production` are separate Cloud Run services, each with its own Cloud SQL
database and its own Secret Manager secrets, deployed from the same image.
Environment selection is entirely via environment variables (see
`.env.example`) — there is no `if (env === 'staging')` branching in
application code beyond provider configuration.

## 12. What Phase 1 delivers vs. what it stubs

Phase 1 (this commit) delivers, for real, with no mocked data:

- Project scaffold, design tokens, and a rendered style guide.
- The full relational schema (`DATABASE.md`), migrated into a real Postgres
  database.
- Working signup/login/logout against that database, with hashed passwords
  and DB-backed sessions.
- A working RBAC engine seeded with the real role/permission set and covered
  by unit tests.
- Route protection (`proxy.ts`) and an audit-log utility used by the auth
  flows themselves.

Phase 1 deliberately does **not** include products, orders, payments, or CMS —
those are Phases 2–8 in `IMPLEMENTATION_PLAN.md`. Nothing in this phase renders
a fake number or a button with no handler; where a future phase's surface
would otherwise be an empty shell, it is simply not built yet.
