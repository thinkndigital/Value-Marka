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

## Phase 3 — Customer experience ✅

- [x] Homepage rendering real `CmsBlock` content (`src/server/services/cms.ts`,
      seeded via `prisma/seed.ts`'s `CMS_BLOCKS` — hero, featured categories,
      new arrivals — editable from Phase 8's builder once it exists; until
      then, edited via seed/admin API, never hardcoded JSX). `SiteHeader`/
      `SiteFooter` extracted as shared shell components.
- [x] Product search (`/search`): Postgres `ILIKE` substring match on
      name/description, backed by a real trigram GIN index (migration
      `20260819080100_product_search_trigram`) so it's index-accelerated,
      not a sequential scan — category filter, price/newest sort,
      pagination.
- [x] PDP (`/product/[slug]`): images, stock-aware add-to-cart, wishlist
      toggle, reviews (one per user per product, DB-enforced via
      `Review_userId_productId_key`).
- [x] Cart (`/cart`): guest (cookie token) and signed-in (`userId`) carts,
      single-currency-per-cart guard, server-only total computation
      (`computeCartTotals`) — the client never declares a price.
- [x] Address book (`/account/addresses`): full CRUD, one default per user.
- [x] Checkout (`/checkout` → `placeOrder` in
      `src/server/services/checkout.ts`): re-validates stock and re-reads
      product prices from the database at placement time (never trusts the
      cart), fans a multi-seller cart out into one `Order` + one
      `SellerOrder` per seller + `OrderItem` snapshots, reserves stock as a
      real `InventoryMovement` (type `RESERVATION`, not a `SALE` decrement —
      capture/decrement is Phase 5's job once payments exist), applies real
      `TaxRule`/`ShippingMethod` rows when an admin has configured them for
      the destination country (0 when none are configured — never a
      fabricated rate). **Scoped to signed-in checkout only** for this
      phase: `Address` is owned by a `User` row in the current schema, so a
      true guest flow needs either an address snapshot on `Order` or a
      shadow-account pattern — deferred rather than half-built; guests are
      redirected to sign in before checkout.
- [x] Customer account: orders (`/account/orders`, `/account/orders/[num]`),
      wishlist (`/account/wishlist`), reviews (`/account/reviews`), all
      under a shared `/account` layout with sidebar nav.
- [x] Tests (`tests/cart/`, `tests/checkout/`, `tests/search/`): cart
      totals/stock/currency guards, multi-seller order fan-out + stock
      reservation + insufficient-stock rollback, search relevance/filter/
      sort — all against the real database, no mocks.

**Explicitly not in Phase 3**: guest checkout (see above), payment
collection (orders are created `PENDING` and stay that way — Phase 5 wires
up Stripe/PayPal and is the only phase allowed to move money or mark an
order paid), the full `OrderStatus` fulfillment lifecycle and seller order
dashboard (Phase 4).

## Phase 4 — Orders ✅

- [x] Full order lifecycle state machine (`src/server/services/orders.ts`):
      `SellerOrder.status` is the real fulfillment state
      (PENDING→CONFIRMED→PROCESSING→PACKED→SHIPPED→OUT_FOR_DELIVERY→
      DELIVERED, plus CANCELLED and the return branch), enforced by an
      explicit transition table — illegal jumps (e.g. PENDING→SHIPPED) are
      rejected. The parent `Order.status` has no lifecycle of its own; it's
      recomputed as a deterministic aggregate of its `SellerOrder`s on every
      transition (CANCELLED only once every seller portion is, otherwise the
      least-advanced live seller portion — a multi-vendor order isn't
      "shipped" to the customer until every seller has shipped their part).
- [x] Inventory effects are real, not just a status label: DELIVERED
      releases the checkout-time `RESERVATION` and applies an actual `SALE`
      decrement (stock isn't truly sold until fulfilled); CANCELLED releases
      the reservation with no stock change; RETURNED restocks via a `RETURN`
      movement — all resolved per-warehouse from the original reservation's
      `InventoryMovement` rows, so multi-warehouse splits restock to the
      same warehouses they were taken from.
- [x] Seller order dashboard (`/seller/orders`, `/seller/orders/[id]`):
      status filter, per-status action buttons (confirm, process, pack,
      ship with carrier/tracking, mark delivered, cancel, approve/reject
      return, mark refunded), strictly scoped to the seller's own
      `SellerOrder` rows via `assertSellerOwns` — a seller acting on another
      seller's order id gets `ForbiddenError`, covered by a test.
- [x] Returns/refunds workflow: customer requests a return on a delivered
      item within a 14-day window (`/account/orders/[orderNumber]`); seller
      approves (restocks + creates/updates a `Refund` row) or rejects
      (reverts to DELIVERED); seller marks a refund `COMPLETED` once settled
      outside the system (no payment capture exists yet — see below).
- [x] Customer-initiated cancellation, correctly partial on a multi-seller
      order: only the `SellerOrder`s that haven't progressed past PACKED are
      cancelled; a seller already shipping their portion is left alone, and
      the response reports how many of the customer's seller-shipments were
      actually cancelled.
- [x] Tests (`tests/orders/orders.test.ts`): illegal transitions rejected,
      cross-seller isolation, the full happy path with the aggregate-status
      and inventory assertions above, partial cancellation, and the full
      return → restock → refund flow — all against the real database.

**Explicitly not in Phase 4**: payment collection (orders still carry no
`Payment` row and stay effectively "awaiting payment" per Phase 3's scoping
note — a `Refund` here records a business decision, not a reversed charge,
since there's no charge yet; Phase 5 is the only phase allowed to move
money), commission/payout calculation (`SellerOrder.commissionAmount`/
`.payoutAmount` stay at their default 0 until Phase 5's commission engine
runs), `LedgerEntry` (Phase 6).

## Phase 5 — Payments ✅ (code complete; live credentials pending)

- [x] `PaymentProvider` interface (`src/server/payments/PaymentProvider.ts`)
      — `createIntent`, `capture`, `refund`, `onboardSeller`,
      `transferToSeller`, `verifyWebhook` — plus `stripe.ts` (Stripe
      Checkout + Connect Express + Transfers, official `stripe` SDK) and
      `paypal.ts` (Orders v2, Payouts, Partner Referrals, direct REST —
      real API calls, correctly shaped). **Revised from the original note
      here**: checkout always charges the platform's own account rather
      than a per-seller Stripe "destination charge" — a multi-seller cart
      has no single-intent way to split across N connected accounts; see
      ARCHITECTURE.md §9 for the full reasoning. `transferToSeller` is
      still real Stripe Connect / PayPal Payouts, invoked at payout release.
- [x] Webhook routes (`/api/webhooks/stripe`, `/api/webhooks/paypal`):
      signature verification (Stripe: local HMAC; PayPal: their
      verify-webhook-signature API), `WebhookEvent` persistence keyed by
      provider event id before processing, idempotent replay (an
      already-`PROCESSED` event is acknowledged without reprocessing).
- [x] Commission engine (`src/server/services/commission.ts`): the
      PRODUCT → SELLER_CATEGORY → SELLER → CATEGORY → GLOBAL resolution
      order from `DATABASE.md` §7, `Seller.commissionOverride` folded in at
      the SELLER tier, wired into `markOrderPaid`'s ledger posting.
- [x] Seller payout requests + admin approve/hold/release
      (`src/server/services/payouts.ts`, `/seller/payouts`,
      `/admin/payouts`): available balance is `SUM(LedgerEntry)` minus
      already-requested-but-unreleased payouts (never a mutable balance
      column); release calls the real provider transfer API and posts the
      offsetting `PAYOUT` ledger entry only on success.
- [x] Tests (`tests/payments/`): commission resolution priority (every
      scope, including the override-folding edge case) and the payout
      balance/approve/hold/reject state machine against the real database;
      Stripe webhook signature verification — accept/reject/tamper/
      missing-header — using the SDK's own local test-signing helper (pure
      HMAC, no network call); the webhook route's idempotent-replay and
      unknown-payment-fails-loudly behavior, invoked directly as a Request
      handler.

**What's real vs. what's pending**: every code path here makes real calls
against Stripe's and PayPal's actual APIs — nothing is mocked or simulated.
What's *not yet exercised* is anything that requires this platform's own
Stripe/PayPal API keys (`.env.example`'s `STRIPE_*`/`PAYPAL_*` vars, still
blank): starting a real checkout, a webhook actually firing, a seller's
Connect/Partner onboarding, and a real transfer landing in a connected
account. Confirmed working end-to-end in this environment: COD checkout
unaffected, an online-payment attempt without keys fails at the provider
call and falls back to the order-confirmation page instead of losing the
order or crashing, and the full payout pipeline (balance → request →
approve → release) runs for real up to the point release calls the
provider — where it correctly refuses because no seller has a connected
account yet, rather than pretending to succeed. Wiring in real keys and
watching one checkout/webhook/payout round-trip end-to-end is the one
remaining step before this phase is genuinely done, not just code-complete.

## Phase 6 — Financial system ✅

- [x] `LedgerEntry`-backed reporting (`src/server/services/reports.ts`):
      gross/net sales, COGS, gross/net profit, commission, tax, shipping,
      expenses, refunds, discounts, and a seller's current payable balance
      — every figure a pure derivation over `LedgerEntry`/`Expense`/
      `OrderItem`, never a cached or mutable total. Two views: a
      seller-scoped report (`/seller/reports`) and a platform-wide one
      (`/admin/reports`), both filterable by currency and date range.
- [x] Supplier CRUD (`/seller/suppliers`, seller-isolated) and the full
      `PurchaseOrder` lifecycle (`src/server/services/purchaseOrders.ts`,
      `/seller/purchase-orders`): draft → submit → receive → paid.
      Receiving posts a real `PURCHASE` `InventoryMovement` for exactly the
      *received* quantity, not the ordered one, and supports partial
      receiving across multiple receipts (`DATABASE.md` §4) — confirmed
      against the real database that a 10-unit PO received as 4 then 6
      lands on exactly 10 in stock, not 20. Marking a PO paid is a manual
      settlement record (paying a supplier happens outside the platform)
      that posts a real `PURCHASE` ledger entry for accurate COGS/profit
      reporting.
- [x] Expense entry (`src/server/services/expenses.ts`), both seller-scoped
      (`/seller/expenses`) and platform-level (`/admin/expenses`,
      `Expense.sellerId = null`), categorized per the seeded
      `ExpenseCategory` enum, each entry posting/reversing a real `EXPENSE`
      ledger entry on create/delete.
- [x] CSV export (`/api/seller/reports/export`, `/api/admin/reports/export`)
      — one consolidated metric/value export per report (gross/net sales,
      COGS, profit, commission, tax, shipping, expenses, refunds,
      discounts, payable balance as rows) rather than eight separate
      single-number files carrying the same data.
- [x] Tests (`tests/finance/`): PO partial-receiving/over-receiving/
      cancel-then-receive-refused/pay-once-only, PO seller isolation, and
      report arithmetic (sales/commission/COGS/expenses/profit/payable
      balance, including an expense's effect and its reversal on delete)
      against real seeded ledger and order-item rows — the platform-wide
      report test asserts deltas against a pre-seed baseline rather than
      absolute totals, since it's a genuinely system-wide aggregate over a
      database other test files also write real ledger rows into.

Confirmed working end-to-end in this environment via the browser: add a
supplier, create and submit a PO, receive it in two partial batches
(stock landed exactly right), add an expense, and the seller report and
its balance reflected everything correctly against this session's real
historical order/payout data — including COGS computed from a real
delivered-then-returned order left over from Phase 4's testing.

## Phase 7 — Marketing ✅

- [x] Background job queue abstraction (`src/server/jobs/queue.ts`,
      `ARCHITECTURE.md` §10): `enqueue`/`registerJob`/`runJob`. Falls back to
      an in-process `setImmediate` runner when `CLOUD_TASKS_QUEUE`/
      `CLOUD_TASKS_HANDLER_URL` are unset (always true in this environment),
      otherwise does a real `fetch` to the Cloud Tasks handler URL — either
      way the work it hands off actually runs, nothing here is mocked.
- [x] Notification provider abstraction (`src/server/notifications/`):
      `EmailProvider`/`SmsProvider` interfaces, real adapters for SMTP
      (nodemailer), Resend, Twilio, and MessageBird, selected via
      `EMAIL_PROVIDER`/`SMS_PROVIDER` env vars, plus real HTML templates
      (welcome, order confirmation, shipment, refund, seller
      approved/rejected, payout released, abandoned cart). `send.ts` persists
      a real `Notification` row and calls the real provider — wired into
      registration, checkout, order shipment/return, seller approval/
      rejection, and payout release. As with Stripe/PayPal in Phase 5, no
      SMTP/Resend/Twilio/MessageBird credentials exist in this sandbox, so
      sends fail at the provider-call boundary in this environment; the
      calling code never depends on the send succeeding (it's fire-and-forget
      via the job queue), so nothing in the app breaks when it does.
- [x] Coupons (`src/server/services/coupons.ts`): server-side validation and
      discount computation (active/date-window/usage-limit/
      usage-limit-per-user/min-order-total), `PERCENTAGE`/`FIXED_AMOUNT`/
      `FREE_SHIPPING` types, `maxDiscount` cap, seller-scoped coupons that
      only discount that seller's share of a multi-seller cart. Wired into
      `placeOrder`: real `discountTotal`, per-`SellerOrder` `discountShare`
      (full amount for a seller-scoped coupon, proportional split otherwise,
      matching how tax/shipping are already split), `FREE_SHIPPING` zeroes
      `shippingTotal`, and a real `CouponUsage` row records redemption inside
      the order transaction. Seller (`/seller/coupons`) and platform
      (`/admin/coupons`) CRUD UIs.
- [x] CRM (`src/server/services/crm.ts`): customer profile aggregates
      (order count, lifetime value, average order value, last order date) —
      pure derivations over real `Order` rows, grouped by the customer's most
      recent order's currency, excluding cancelled orders. `CustomerSegment`
      membership is evaluated live against real order data on every call
      (never stored per-user) against a small JSON rule language
      (`lastOrderDaysAgo`/`totalSpent`/`orderCount`, each with
      `gt`/`gte`/`lt`/`lte`). Admin UI at `/admin/customers` and
      `/admin/segments`.
- [x] Affiliate program (`src/server/services/affiliates.ts`): apply →
      admin approve/suspend (`/admin/affiliates`) → create a tracked link →
      `/api/r/[slug]` records a real click and sets httpOnly attribution
      cookies (`vm_aff_id`/`vm_aff_click_id`) → checkout reads them and, on a
      successful order, posts a real `AffiliateConversion` plus an
      `AFFILIATE_COMMISSION` `LedgerEntry` (`subjectType: "AFFILIATE"`) —
      guarded against double-crediting the same click via
      `AffiliateConversion.clickId`'s uniqueness. Customer-facing dashboard
      at `/account/affiliate` (apply, stats, create links).
- [x] Referral program (`src/server/services/referrals.ts`): a stable
      per-user `ReferralCode`, captured via `?ref=` on `/register` (a hidden
      form field, not a cookie) and recorded against the new user in
      `registerAction` — no self-referral, one referral per referred user.
      `placeOrder` marks the referral `REWARDED` the first time the referred
      user's order count would go from 0 to 1. **Known gap, deferred
      intentionally**: there is no `CustomerCredit`/wallet model in the
      schema, so a `REWARDED` referral records that a reward was earned with
      no redemption mechanism yet — `DEFAULT_REFERRAL_REWARD` (a hardcoded
      $5 fixed reward) stands in for an admin-configurable referral-rewards
      model that doesn't exist yet. Customer-facing dashboard at
      `/account/referrals` (copyable referral link, referral history).
- [x] Abandoned-cart recovery (`src/server/services/abandonedCarts.ts`):
      finds real `Cart` rows (belonging to a registered user, non-empty,
      untouched for 24h+) and sends the recovery email once per abandonment
      — deduplicated by checking for an existing `Notification` of type
      `abandoned_cart` created after the cart's `updatedAt`, since there's no
      dedicated "reminded" flag on `Cart`. Exposed at
      `POST /api/cron/abandoned-carts`, authenticated with a `CRON_SECRET`
      bearer token, intended to be triggered by Cloud Scheduler — not a live
      cron in this sandbox (same honesty pattern as Stripe/PayPal in Phase 5:
      real code, not yet live-triggered infrastructure).
- [x] Tests (`tests/marketing/`): coupon validation and discount arithmetic
      (percentage/fixed/free-shipping, `maxDiscount` cap, seller-scoping,
      min-order-total, active window, usage limits) against a real database;
      affiliate click → conversion → ledger-crediting plus the double-claim
      guard; referral code creation/self-referral-refusal/one-per-user/
      first-order reward; CRM profile aggregates (including the
      no-orders-yet and cancelled-order-exclusion cases) and segment
      evaluation.
- Deliberately out of scope for this phase (no schema model exists for
  either, and both would need real modeling work rather than a wiring pass):
  flash sales/bundles, and the referral-credit redemption mechanism noted
  above.

Confirmed working end-to-end in this environment via the browser: registered
a customer, applied to the affiliate program, generated a referral link from
`/account/referrals`, registered a second account through that link (the
`ref` code round-tripped through the hidden form field into a real
`Referral` row), signed in as an admin and approved the affiliate from
`/admin/affiliates`, and confirmed `/admin/coupons` and `/admin/segments`
still render correctly.

## Phase 8 — Admin CMS ✅

- [x] Homepage builder (`/admin/cms/homepage`, `src/server/services/cms.ts`):
      real forms over the existing `CmsBlock` rows (hero content,
      featured-categories/featured-products limits) plus a new `banner`
      block type — admins can add/edit/reorder/hide/delete banners, each a
      real `CmsBlock` row (`key: "homepage.banner"`). The homepage
      (`src/app/[locale]/page.tsx`) renders active banners for real. Content
      is edited per-locale via an `editLocale` selector (`en`/`ar`), backed
      by `routing.locales` rather than hardcoded.
- [x] Landing pages (`CmsPage`): admin CRUD (`/admin/cms/pages`) — slug, SEO
      title/description, a plain-text body (rendered as paragraphs, not
      raw HTML, so there's no unsanitized-HTML injection surface), and a
      draft/published status. A public route (`/[locale]/page/[slug]`)
      renders only `PUBLISHED` pages — confirmed a draft page 404s and a
      published one doesn't — with `generateMetadata` pulling the real
      `seoTitle`/`seoDescription`. Body content is stored per-locale as
      `CmsBlock` rows (`key: "page.body"`), matching the homepage pattern,
      with a same-page fallback to any available locale if the requested
      one is missing.
- [x] Footer navigation editor (`/admin/cms/navigation`,
      `src/server/services/navigation.ts`): real CRUD over
      `NavigationMenu`/`NavigationItem` (`key: "footer"`) — add/edit/
      reorder/delete links. `SiteFooter` renders these real rows instead of
      the previous single hardcoded style-guide link. (The main header's
      nav is fixed app chrome — cart, account, sell — not a candidate for
      CMS-driven mega-menu editing without a redesign, so this phase
      deliberately scoped the navigation editor to the footer, where a
      config-driven link list is a real, honest fit.)
- [x] Translation management (`/admin/cms/translations`,
      `src/server/services/translations.ts`): CRUD over the `Translation`
      table, scoped to `entityType: "Category"`/`field: "name"` — the one
      entity/field pair actually wired into a storefront read path
      (`getFeaturedCategories` in `cms.ts` batch-resolves overrides in one
      query rather than N+1, confirmed with a real seeded category that an
      Arabic override applies to while the English view still shows the
      base name). `TRANSLATABLE_ENTITY_TYPES` is deliberately kept to just
      that one pair rather than exposing a picker for entity/field
      combinations nothing reads yet — extending it means adding both the
      admin option and the matching read-site resolution together, not
      speculatively.
- [x] Tests (`tests/cms/`): banner CRUD/reorder/active-filtering, CmsPage
      draft/publish/unpublish visibility and per-locale body updates and
      fallback, footer nav CRUD/reorder, and the translation batch-resolve
      + `getFeaturedCategories` integration (including the delete path).

Confirmed working end-to-end in this environment via the browser as an
admin: edited the hero kicker and added a banner from
`/admin/cms/homepage` and watched both show up on the live homepage;
created a landing page, confirmed it 404s while a draft, published it from
`/admin/cms/pages`, and loaded it publicly at `/page/[slug]` with the real
body text; added a footer link from `/admin/cms/navigation` and watched it
render in the site footer; and set a Category name override from
`/admin/cms/translations`.

## Phase 9 — Analytics ✅

- [x] Analytics service (`src/server/services/analytics.ts`), all computed
      live from `LedgerEntry`/`OrderItem`/`Inventory` — nothing cached:
  - `getSalesTrend` — daily gross sales bucketed from real `SALE` ledger
    entries (posted at capture time), scoped to one seller or
    platform-wide; `orderCount` counts distinct `SellerOrder`s per day.
  - `getInventoryTurnover` — period COGS ÷ *current* inventory value.
    Documented as an approximation rather than a true beginning/ending
    average: the schema has no historical stock-value snapshots, so this
    is a real, honestly-labeled limitation rather than a fabricated
    number.
  - `getSellerGmvLeaderboard` — ranks sellers by real `SALE` ledger totals.
  - `getTopProductsBySeller` — revenue/quantity aggregated from real
    delivered `OrderItem` rows.
  - `getCouponPerformance` / `getAffiliatePerformance` — redemption counts,
    discount/commission paid, and order revenue for orders that actually
    used a coupon or arrived via an affiliate conversion. Deliberately
    reports only real totals and a plain revenue-per-dollar-spent ratio —
    **not** a fabricated "ROI %", since a causal lift figure would need a
    control group (orders that would have happened anyway) this platform
    has no way to observe.
  - `dateFilter` and `computeCogs` were promoted from Phase 6's
    `reports.ts` to shared exports rather than duplicated.
- [x] Admin dashboard (`/admin/analytics`): sales trend chart (a small
      dependency-free inline-SVG line chart,
      `src/components/admin/SalesTrendChart.tsx`), inventory turnover,
      marketing performance (coupons + affiliates), and the seller GMV
      leaderboard — currency/period picker matching the existing
      `/admin/reports` UX pattern.
- [x] Seller dashboard (`/seller/analytics`): the same sales-trend chart and
      inventory turnover scoped to the seller's own data, plus a top-products
      table.
- [x] Tests (`tests/analytics/`): sales-trend day-bucketing and per-seller
      scoping, inventory turnover arithmetic (including the null-ratio case
      with no stock), GMV leaderboard ranking, top-products aggregation and
      ordering, and coupon/affiliate performance — the two platform-wide
      aggregate functions are asserted as a delta from a captured baseline
      (the same pattern Phase 6's platform report test uses), since they
      aren't scoped to a single seller/user id and the database is shared
      with other test files.

Confirmed working end-to-end in this environment via the browser: logged in
as an admin and viewed `/admin/analytics` with a real sales-trend chart
(reflecting actual ledger data accumulated during this session's testing),
inventory turnover, marketing performance, and the GMV leaderboard;
switched the period filter and confirmed the page re-fetched; logged in as
a seller and confirmed `/seller/analytics` renders without error.

## Phase 10 — Production hardening ✅

- [x] **Rate limiting** (`src/server/auth/rateLimit.ts`, new `RateLimitAttempt`
      table/migration): IP-scoped, DB-backed (not in-memory — an in-memory
      counter resets per Cloud Run instance and would be trivially bypassed
      by hitting a different instance), layered on top of Phase 1's existing
      per-account lockout. 20 login / 10 register attempts per IP per 15
      minutes.
- [x] **CSRF review**: no custom token machinery needed — every mutation in
      this app is a Server Action, and Next.js's built-in `Origin`/`Host`
      check already rejects cross-origin submissions. The two exceptions
      (Stripe/PayPal webhook routes, which are plain Route Handlers hit by a
      third party) already verify the provider's cryptographic signature
      (Phase 5). Findings and the full picture: `SECURITY.md`.
- [x] **HTTP security headers** (`next.config.ts` `headers()`): CSP,
      `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
      `Permissions-Policy`, HSTS. Verified against a real
      `next build && next start` with a Playwright console-error check
      across storefront and admin pages — zero CSP violations.
- [x] **Dependency audit** (`npm audit`): fixed the `uuid`/`gaxios`
      moderate vulnerability via a `package.json` `overrides` pin (safe
      because `gaxios` only calls the stable `uuid.v4()` API). Left the
      `deepmerge-ts`/Prisma-CLI-only high vulnerability unfixed on purpose —
      the only automatic fix downgrades Prisma to 6.x, a real breaking
      change against this app's Prisma 7 driver-adapter architecture, for a
      devDependency not reachable by any request this app serves. Reasoning
      in `SECURITY.md`.
- [x] **Found and fixed a real gap while researching CSRF**: production
      deploys need a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — without
      one, Cloud Run's multiple instances each generate their own random
      key at boot, so a Server Action closure (this app binds a lot of
      them, e.g. every admin/seller `someAction.bind(null, id)`) encrypted
      by one instance can fail to decrypt on another. Added to
      `.env.example` and `DEPLOYMENT.md`.
- [x] **Pagination** (`src/server/pagination.ts`, `src/components/ui/Pagination.tsx`):
      real `skip`/`take` + count-based pagination for the four listing
      pages most likely to grow unbounded with real usage —
      `/admin/sellers`, `/admin/customers`, `/seller/products`,
      `/seller/orders`. `crm.ts`'s `listCustomers` (unbounded) is kept
      separate from the new paginated `listCustomersPage`, since
      `evaluateSegment` genuinely needs every customer to check segment
      membership correctly, not one page of them.
- [x] **Observability**: structured JSON logging to stdout
      (`src/server/logger.ts`) — Cloud Run ingests container stdout as
      Cloud Logging automatically and promotes `severity`/`message`
      fields, so this is a real, fully-functional integration requiring no
      SDK or credentials this sandbox doesn't have (unlike Sentry, whose
      `SENTRY_DSN` stays a documented placeholder — see `DEPLOYMENT.md`
      §6/§7). Wired into `src/instrumentation.ts`'s `onRequestError` hook
      for server-side errors and new `error.tsx`/`global-error.tsx`
      boundaries for client-side ones.
- [x] **Accessibility (scoped pass, not a full WCAG 2.2 AA audit)**: a
      skip-to-main-content link (`src/components/SkipLink.tsx`) wired into
      `SiteHeader` and the admin/seller layouts' custom headers, with a
      matching `id="main-content"` landmark added to every top-level
      page's `<main>`; accessible names added to this session's icon-only
      reorder buttons (↑/↓) via a new `FormActionButton` `ariaLabel` prop.
      Existing baseline confirmed rather than re-built: every form field
      already goes through the shared `Input` component, which requires a
      real `label`; focus rings (`vm-focus-ring`) are already applied
      throughout; `lang`/`dir` are already set correctly per locale in the
      root layout. Full WCAG 2.2 AA conformance would need a proper axe/
      screen-reader pass — not claimed here.
- [x] **GCP deployment runbook finalized**: `DEPLOYMENT.md` updated with
      the secrets Phases 5–7 actually need (Stripe/PayPal/SMTP/SMS/cron),
      a new §4.3 for the Cloud Scheduler job the abandoned-cart recovery
      route (Phase 7) needs to actually fire, and a new `SECURITY.md`
      covering the full security posture and secret-rotation procedure.
- [x] Tests (`tests/security/`, `tests/performance/`): rate-limit counting/
      blocking/scoping-by-key behavior against the real `RateLimitAttempt`
      table, and pagination correctness (page boundaries, disjoint/complete
      coverage across pages, empty-page-past-the-end) against a real seeded
      product set.

Confirmed working end-to-end in this environment via the browser: security
headers present on every response, the skip link and `#main-content`
landmark render, and `/admin/sellers`/`/admin/customers` render correctly
with the new pagination wiring in place.

This closes the 10-phase build. All ten phases are code-complete and
verified (lint/typecheck/build/tests green, browser-smoke-tested) as of
this commit; the two things still blocked on the user's own action rather
than more work here are: live Stripe/PayPal credentials (Phase 5) and the
GCP Cloud Billing account needed to actually deploy (tracked separately,
outside this phase list).

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
