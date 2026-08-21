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
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
