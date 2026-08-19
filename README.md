# Value Marka

A multi-vendor marketplace platform. See [ARCHITECTURE.md](./ARCHITECTURE.md),
[DATABASE.md](./DATABASE.md) and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
for the full design and phased build plan — this README only covers running
the codebase locally.

Stack: Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, PostgreSQL +
Prisma 7, `next-intl` (English/Arabic, RTL).

## Prerequisites

- Node.js 22+
- A PostgreSQL 16 database

## Setup

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and SESSION_SECRET
npm run db:migrate     # applies prisma/migrations and seeds roles/permissions/reference data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/en` or
`/ar` depending on your browser's language.

`SESSION_SECRET` must be at least 32 random characters:

```bash
openssl rand -base64 32
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed roles/permissions + language/currency/country reference data |
| `npm run db:studio` | Prisma Studio |

## What's here (Phases 1–2)

- The full relational schema for the marketplace, migrated into Postgres —
  see `prisma/schema.prisma` and [DATABASE.md](./DATABASE.md).
- Real authentication: signup/login/logout, hashed passwords, database-backed
  sessions (`/register`, `/login`, `/account`).
- A real RBAC engine seeded with the platform's 12 roles and ~80 granular
  permissions (`src/server/rbac.ts`, `prisma/seed.ts`).
- The Value Marka design system as Tailwind v4 tokens plus a rendered
  component library at `/style-guide`.
- English/Arabic routing with RTL support (`next-intl`).
- Category/brand catalog admin (`/admin/categories`, `/admin/brands`).
- Seller onboarding + admin approval (`/sell`, `/admin/sellers`).
- Seller product CRUD with image upload, warehouses, and inventory tracked
  through an immutable movement log (`/seller/products`, `/seller/warehouses`).
- A public seller store page (`/store/[slug]`) and product CSV import/export.

Orders, payments, CMS and everything else in the spec are later phases —
see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md). Nothing in this
codebase renders placeholder or mocked data for a feature that isn't built
yet.

## Project structure

```
prisma/                  schema.prisma, migrations, seed.ts
src/
  app/[locale]/           App Router pages (locale-prefixed: admin/, seller/,
                          store/[slug], sell, style-guide, ...)
  app/api/                Route Handlers (e.g. seller product CSV export)
  components/ui/          Design-system primitives (Button, Card, Input, ...)
  components/{admin,seller,auth}/  Feature-specific client components
  i18n/                   next-intl routing/navigation/request config
  messages/                en.json / ar.json
  server/
    auth/                 sessions, password hashing, DAL, guards
    services/              domain logic (categories, brands, sellers,
                            warehouses, inventory, products, product-csv)
    {catalog,sellers,products,warehouses}/actions.ts  Server Actions
    storage/                local-disk / GCS upload adapters
    db.ts                  Prisma client (driver adapter: @prisma/adapter-pg)
    rbac.ts                 permission resolution + seller-isolation guards
    audit.ts                audit log writer
  proxy.ts                 route protection + locale routing (Next 16 renamed
                            middleware.ts → proxy.ts)
```
