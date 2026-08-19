# Value Marka — Database

The authoritative schema is [`prisma/schema.prisma`](./prisma/schema.prisma). This
document explains the relationships, the algorithms that aren't obvious from the
field list, and which parts Phase 1 actually migrates vs. models for later use.

Provider: PostgreSQL. ORM: Prisma 7 (driver adapter: `@prisma/adapter-pg`, see
`src/server/db.ts`). Money fields are `Decimal` (`@db.Decimal(14,4)`), never
`Float` — Postgres `NUMERIC` avoids the binary floating-point rounding errors
that are unacceptable in financial calculations. Percentages/rates use
`Decimal(6,4)` stored as a fraction (`0.1000` = 10%).

## 1. Identity & RBAC

```
User ──< UserRole >── Role ──< RolePermission >── Permission
  │
  ├──< Session            (DB-backed session, cookie only carries the signed id)
  ├──< VerificationToken  (email/phone verification, password reset)
  └──< AuditLog (as actor)
```

- `UserRole` scopes a role either globally (`sellerId = null`) or to one seller
  (seller staff accounts), so "Seller A's warehouse manager" and "platform
  Finance admin" are the same mechanism.
- `Permission.key` is `resource.action[.scope]` (`products.read`,
  `orders.refund`, `finance.read.any`). `RolePermission` is the only place
  permissions attach to a role — application code never checks role name
  directly, only resolved permissions (see `src/server/rbac.ts`).
- `AuditLog` is append-only; nothing in the codebase issues `UPDATE`/`DELETE`
  against it.

## 2. Localization & global config

`Language`, `Country`, `Currency`, `TaxRule` are tables, not enums or
hardcoded lists — adding Kuwait or KWD is a seed-data change, not a deploy.
`ExchangeRate` rows are immutable snapshots (`effectiveAt`); an order stores
the rate it used at checkout time via its own `currencyCode` + the
`Payment`/`LedgerEntry` amounts, so historical numbers never drift when
today's rate changes.

`Translation` is a generic `(entityType, entityId, locale, field) -> value`
table. Any translatable row (a `Category` name, a `CmsBlock`'s copy, a
`NavigationItem` label) is translated by inserting rows here instead of adding
`nameEn`/`nameAr` columns — the schema doesn't need to change when a new
language is added.

## 3. Catalog

```
Seller 1─1 User
Seller ──< Product ──< ProductVariant
                   ├──< ProductImage
                   ├──< ProductAttributeValue
                   └──< Inventory >── Warehouse
Product >── Category (tree via parentId)
Product >── Brand
```

`Product.type` (`SIMPLE | VARIABLE | BUNDLE | DIGITAL`) drives whether
`ProductVariant` rows exist; a `SIMPLE` product still has exactly one implicit
purchasable unit represented by the product row itself, so `OrderItem`/`Cart`
always reference `productId` and optionally `variantId`.

`SellerApplication` is the seller onboarding/KYC record; a `Seller` exists as
soon as someone starts onboarding, with `status = PENDING` until an admin
approves it (spec §3 KYC flow).

## 4. Inventory

```
Inventory (product/variant × warehouse) ──< InventoryMovement
```

`Inventory.quantity`/`reserved`/`damaged` are **never written directly by
application code** — every change is expressed as an `InventoryMovement` row
(`PURCHASE | SALE | RETURN | ADJUSTMENT | DAMAGE | TRANSFER | RESERVATION |
RELEASE`) and the aggregate columns are updated in the same DB transaction as
that movement insert. This makes "why did stock change" always answerable and
matches spec §11 literally ("never directly overwrite stock without recording
the movement"). Available-to-sell stock is `quantity - reserved`.

`Supplier` → `PurchaseOrder` → `PurchaseOrderItem` supports partial receiving
(`quantityReceived` accumulates against `quantityOrdered`); receiving a PO
line creates a `PURCHASE` `InventoryMovement` for the received quantity, not
the ordered quantity.

## 5. Orders — the multi-vendor allocation model

```
Order (1 checkout, 1 customer, 1 payment)
  └──< SellerOrder (1 per seller present in the cart)
         ├──< OrderItem
         ├──< Shipment
         └──< Refund
```

Checkout creates one `Order` and fans it out into one `SellerOrder` per
distinct seller in the cart. Money is allocated pro-rata by each
`SellerOrder`'s share of the order subtotal:

```
sellerOrder.discountShare = order.discountTotal * (sellerOrder.subtotal / order.subtotal)
sellerOrder.taxShare      = order.taxTotal      * (sellerOrder.subtotal / order.subtotal)
sellerOrder.shippingShare = order.shippingTotal * (sellerOrder.subtotal / order.subtotal)
```
(Shipping can instead be computed directly per seller when sellers have
distinct shipping methods/warehouses — the schema supports either; the
allocation service documents which one is active.)

`SellerOrder.commissionAmount` and `.paymentFeeShare` are computed by the
commission engine (§7 below) and the payment provider's actual fee,
respectively, and `payoutAmount = subtotal - discountShare - commissionAmount
- paymentFeeShare - refundedAmount`.

**Isolation**: every seller-surface query filters `WHERE sellerId = :sellerId`
against `SellerOrder`, never against `Order`. A seller is never granted a
Prisma query that can `include: { order: { include: { sellerOrders: true } }
}` and see a sibling seller's rows — the seller-scoped repository layer
(Phase 4) only ever selects the caller's own `SellerOrder`s and joins up to
the parent `Order` for shared fields (address, order number), never down into
other sellers' items.

## 6. Payments & the ledger

```
Order ──< Payment ──< PaymentTransaction
```

`Payment` is the provider-facing record (one per attempt/provider);
`PaymentTransaction` records each lifecycle event (`AUTHORIZATION | CAPTURE |
REFUND | CHARGEBACK | PAYOUT`) with the raw provider payload for audit/replay.

`LedgerEntry` is the financial system of record (spec §32):

- **Append-only.** No service updates a balance column; every financial event
  (a sale, the platform's commission cut, a payment-processor fee, a refund, a
  payout, an expense, a purchase, a tax line, a shipping charge, a discount, an
  affiliate commission) inserts one or more signed `LedgerEntry` rows.
- **Balances are derived**, e.g.:
  ```sql
  -- Seller's available payable balance
  SELECT COALESCE(SUM(amount), 0) FROM "LedgerEntry"
  WHERE "subjectType" = 'SELLER' AND "subjectId" = :sellerId;
  ```
  "Payables/Receivables" and "seller available/pending/paid/reserved balance"
  from spec §15/§31 are **views over this table**, not separate mutable
  tables — this guarantees they can never drift from the transactions that
  produced them.
- A `LedgerEntry` always carries `referenceType`/`referenceId` back to the
  `Order`, `SellerOrder`, `Refund`, `Payout`, `PurchaseOrder`, or `Expense`
  that caused it, so every number in a financial report is traceable to a
  concrete business event.

## 7. Commission resolution

`CommissionRule.scope` is one of `GLOBAL | SELLER | CATEGORY |
SELLER_CATEGORY | PRODUCT`. The commission service resolves the effective
rate for an order line by checking scopes from most to least specific and
taking the first active match:

```
PRODUCT (this exact product)
  → SELLER_CATEGORY (this seller × this product's category)
  → SELLER (this seller, any category)
  → CATEGORY (any seller, this category)
  → GLOBAL (platform default)
```

`Seller.commissionOverride` is a convenience shortcut equivalent to a
`SELLER`-scope rule and is folded into the same resolution by the service
(documented in `src/server/services/commission.ts` once Phase 5 implements
it) — the schema keeps both so an admin can see "this seller has an override"
without querying the rules table, while the rules table remains the single
place resolution actually happens.

## 8. Affiliate & referral

```
Affiliate 1─1 User
Affiliate ──< AffiliateLink ──< AffiliateClick ──1─1── AffiliateConversion
```

A click is attributed to a conversion via the (optional, unique)
`AffiliateConversion.clickId`; `stage` (`SESSION | ADD_TO_CART | CHECKOUT |
PURCHASE | COMMISSION`) lets the funnel be reconstructed per spec §17. Fraud
controls (rate limiting per IP, deduplicating clicks within a cookie window,
rejecting self-referral) are enforced in the affiliate service, not the
schema — the schema only guarantees a click can be attributed at most once
(`clickId` unique).

`ReferralCode`/`Referral` are the simpler customer→customer program (spec
§18); rewards are still posted through `LedgerEntry`
(`type = AFFILIATE_COMMISSION` is reused conceptually, or a dedicated
`REFERRAL_REWARD` ledger type is added in the phase that implements payouts —
tracked in `IMPLEMENTATION_PLAN.md` Phase 7).

## 9. Marketing/CRM

`CustomerSegment.definition` is a JSON rule (e.g.
`{"lastOrderDaysAgo": {"gt": 90}}`) evaluated server-side against `Order`/`User`
at send time — segment membership is a query, not a stored join table, so a
segment always reflects current data. `Campaign` → `CampaignStat` holds the
aggregate funnel (`sent/delivered/opened/clicked/converted/revenue`) per spec
§20; per-recipient tracking (open/click) is added when the email provider
integration lands in Phase 7, via provider webhook events written into
`WebhookEvent`-style tables scoped to that provider.

## 10. CMS

`CmsPage` → `CmsBlock` are the homepage/landing-page builder's storage:
`CmsBlock.key` namespaces a section (`homepage.hero`,
`homepage.featured_categories`), `content` is a typed JSON payload the admin
UI edits, and `locale` lets a block have per-language content instead of
relying solely on the generic `Translation` table (useful for whole rich-text
blocks vs. single fields). `NavigationMenu`/`NavigationItem` drive header/mega
menu/footer navigation. Nothing about the homepage is hardcoded in a
component — Phase 8 renders these tables.

## 11. Notifications & webhooks

`Notification` is the in-app/email/SMS-agnostic record used for the
notification center (`channel`, `status`, `priority` per spec §23).
`WebhookEvent` persists every inbound provider webhook (Stripe, PayPal) keyed
by `(provider, eventId)` **before** processing, which is what makes webhook
handling idempotent and replay-safe (spec §30) — a handler checks whether the
event id was already `PROCESSED` before doing anything.

## 12. Shipping

`ShippingZone` (per country) → `ShippingMethod` (optionally scoped to one
seller) holds price/free-threshold/ETA. This is intentionally the simplest
possible real model for Phase 1; provider-specific rate shopping (Aramex,
DHL, SMSA, ...) is an adapter layer added in a later phase that computes a
`ShippingMethod`-shaped quote at checkout time rather than a new table shape.

## 13. What Phase 1 actually uses

Phase 1's code (auth, RBAC) only touches `User`, `Role`, `Permission`,
`RolePermission`, `UserRole`, `Session`, `AuditLog`. Every other model above
is migrated (so the database is the real, complete shape from day one — no
"add the column later" churn) but has no reads/writes yet until its owning
phase in `IMPLEMENTATION_PLAN.md` is built. An empty table is not fake data;
a UI that reads a table and renders numbers that were never written to it
would be.

## 14. Conventions

- Primary keys: `String @id @default(uuid())` everywhere except a handful of
  1:1 "extension" tables that reuse the parent id (`CampaignStat.campaignId`,
  `ReferralCode.userId`) to make the 1:1 relationship structural.
- `createdAt`/`updatedAt` on every mutable entity that isn't append-only-log
  shaped (append-only logs — `AuditLog`, `LedgerEntry`, `InventoryMovement`,
  `AffiliateClick` — only need `createdAt`).
- Foreign keys are always declared as real Prisma relations (not bare string
  columns) so referential integrity is enforced by Postgres, not by
  application discipline alone.
- Cascade deletes are used only for true ownership (`Product.images`,
  `Cart.items`, `Order.sellerOrders`) — never across the seller-isolation
  boundary or on financial records, which are never hard-deleted.
