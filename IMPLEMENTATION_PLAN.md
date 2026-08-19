# Value Marka — Implementation Plan

Ten phases, matching the production spec. Each phase must build, lint,
typecheck, and pass its tests before the next one starts (spec §71/§73) — a
phase is never "the UI is done, backend is TODO."

Status legend: ✅ done · 🚧 in progress · ⬜ not started.

## Phase 1 — Architecture ✅

- [x] Repository scaffold: Next.js 16 (App Router) + TypeScript + Tailwind v4.
- [x] Full relational schema migrated into a real PostgreSQL database
      (`prisma/schema.prisma`, `DATABASE.md`).
- [x] Value Marka design tokens ported into the Tailwind theme; core UI
      primitives + a rendered style guide.
- [x] i18n scaffold: `en`/`ar` routing, RTL, Cairo/Tajawal fonts.
- [x] Authentication: DB-backed sessions, hashed passwords, signup/login/logout.
- [x] RBAC engine seeded with the real role/permission set, unit-tested.
- [x] Route protection (`proxy.ts`), audit-log utility.
- [x] `.env.example`, README, this plan.

**Explicitly not in Phase 1**: products, orders, payments, CMS, marketing —
see phases below. Nothing here renders a number or a button that doesn't
have a real handler behind it.

## Phase 2 — Core marketplace ✅

- [x] Category/Brand admin CRUD (`/admin/categories`, `/admin/brands`),
      RBAC-gated, audit logged, delete blocked while children/products
      reference the row.
- [x] Seller onboarding (`/sell`) + admin approval queue (`/admin/sellers`):
      submitting an application creates a `Seller` + `SellerApplication`
      (PENDING); approval assigns the seeded `SELLER` role scoped to that
      seller and is reflected immediately in the applicant's own UI.
- [x] File storage abstraction (`src/server/storage/`) — local-disk adapter
      for dev, GCS adapter for production — backing category/brand/product
      image uploads with mime/size validation.
- [x] Warehouses (seller-managed) + `Inventory`/`InventoryMovement` service
      (`src/server/services/inventory.ts`) — the only code path allowed to
      write stock, always paired with a movement row. A partial unique DB
      index enforces one Inventory row per product+warehouse when there's
      no variant (Postgres doesn't enforce this via NULL columns alone —
      see migration `20260819072807_inventory_partial_unique_no_variant`).
- [x] Product CRUD for sellers (`/seller/products`) — SIMPLE products only
      this phase (variants are schema-ready, not yet built in the UI);
      creation posts opening stock as a real `PURCHASE` movement; seller
      isolation enforced via `assertSellerOwns` and covered by tests.
- [x] Seller store page (`/store/[slug]`), public, active products only.
- [x] Product CSV import/export, per-row validation with a partial-success
      error report (one bad row doesn't discard the batch).

**Explicitly not in Phase 2**: product variants/bundles, purchase
orders/suppliers, order placement (a store page lists products but has no
cart/checkout yet — that's Phase 3/4). Known accepted risk: `uuid <11.1.1`
(moderate, no attacker-controlled input in our usage) is a transitive
dependency of `@google-cloud/storage`'s `gaxios`, and `deepmerge-ts` (high,
build-tool only) is transitive via the `prisma` CLI — both tracked, neither
fixable without a breaking downgrade; revisit in Phase 10's security pass.

## Phase 3 — Customer experience ⬜

- Homepage rendering real `CmsBlock` content (bootstrapped with a minimal
  default set of blocks, editable from Phase 8's builder once it exists —
  until then, edited via seed/admin API, never hardcoded JSX).
- Product search (Postgres full-text + trigram to start; swappable), PDP,
  cart, address book.
- Checkout: server-side total recomputation, guest + authenticated flows.
- Customer account: orders, wishlist, addresses, reviews.

## Phase 4 — Orders ⬜

- Full order lifecycle state machine (`OrderStatus`), multi-seller
  `SellerOrder` fan-out and allocation (`DATABASE.md` §5).
- Seller order dashboard, strictly scoped to the seller's own `SellerOrder`
  rows (isolation tests required before merge).
- Returns/refunds workflow.

## Phase 5 — Payments ⬜

- `PaymentProvider` interface; Stripe Connect adapter (destination charges +
  `application_fee_amount`) and PayPal adapter against their current REST
  APIs.
- Webhook routes: signature verification, `WebhookEvent` persistence,
  idempotent background processing.
- Commission engine (`DATABASE.md` §7) wired into checkout.
- Seller payout requests + admin approve/hold/release, posted through
  `LedgerEntry`.

## Phase 6 — Financial system ⬜

- `LedgerEntry`-backed reporting: gross/net sales, COGS, gross/net profit,
  platform commission, seller payables, expenses, refunds, discounts, taxes.
- Supplier + `PurchaseOrder` receiving flow feeding `InventoryMovement`.
- Expense entry + categorized reporting.
- CSV export for every report in spec §57.

## Phase 7 — Marketing ⬜

- CRM: customer profile aggregates (LTV, AOV, last order), `CustomerSegment`
  evaluation.
- Coupons, flash sales/bundles, abandoned-cart recovery job.
- Email/SMS provider abstraction wired to real transactional templates
  (welcome, order confirmation, shipment, refund, seller approval, payout).
- Affiliate program (attribution, click/conversion tracking, payouts) and
  customer referral rewards.

## Phase 8 — Admin CMS ⬜

- Visual homepage/landing-page builder writing `CmsPage`/`CmsBlock`.
- Navigation/mega-menu editor, banners, SEO metadata editor, translation
  management UI over the `Translation` table.

## Phase 9 — Analytics ⬜

- Admin dashboard: sales, profit, inventory turnover, seller GMV, campaign
  ROI — all computed from `LedgerEntry`/`Order`/`InventoryMovement`, never
  a cached "fake" number.
- Seller analytics scoped to their own data.

## Phase 10 — Production hardening ⬜

- Security checklist pass (rate limiting, CSRF review, dependency audit,
  secret rotation).
- Performance pass (query indexes already in `schema.prisma`; add caching,
  pagination, image optimization as real traffic patterns emerge).
- Full test suite: seller isolation, commission math, ledger integrity,
  webhook idempotency, RBAC.
- Accessibility (WCAG 2.2 AA) pass, monitoring/logging wired to Cloud
  Logging, GCP deployment runbook finalized.

## Working rules for every phase

1. No fake data, no mocked functionality, no "coming soon" on core flows —
   if a feature can't be finished in a phase, it is left absent rather than
   faked (spec §73).
2. Every new feature gets: DB model → service → validation → authorization →
   UI → error/empty/loading states → audit logging where sensitive → tests,
   in that order.
3. Money/inventory/commission logic lives in `src/server/services/*`, never
   in a component or a route handler body.
4. A phase does not start until the previous phase's `npm run lint`,
   `npx tsc --noEmit`, `npm run build`, and `npm test` are all green.
