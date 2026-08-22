import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional in environments where DATABASE_URL is already set
}

// Prisma 7 moved the datasource connection string out of schema.prisma.
// This file is used by `prisma migrate` / `prisma studio` / `prisma db push`.
// The application itself connects via the driver adapter in src/server/db.ts,
// which reads DATABASE_URL directly (see .env.example).
//
// Deliberately `process.env.DATABASE_URL` here, not `prisma/config`'s `env()`
// helper — `env()` throws at config-load time if the variable is unset,
// which broke `prisma generate` (part of the build script; see
// package.json) on platforms like Vercel that don't have DATABASE_URL
// available at build time. `generate` never touches the datasource, only
// `migrate`/`db push`/`studio` do — those still fail naturally (and
// appropriately) if DATABASE_URL is genuinely missing when actually
// connecting, just not merely from loading this file.
//
// `migrate deploy` takes a Postgres advisory lock, which needs a
// session-level connection — it hangs and fails with P1002 ("timed out
// trying to acquire a postgres advisory lock") against a *pooled*
// connection string (Neon/Supabase/Vercel Postgres poolers, PgBouncer in
// transaction mode), because the pooler can hand different statements to
// different backend sessions. DIRECT_URL, when set, is the same database's
// direct/unpooled connection string and is what migrations use instead —
// see .env.example. The app's own runtime connection (src/server/db.ts)
// is unaffected either way and keeps using the (possibly pooled)
// DATABASE_URL, since ordinary queries don't need session affinity.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
