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
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    // Prisma generate runs during builds where DATABASE_URL may not be present.
    // Migrations still use DATABASE_URL when it is configured.
    url: process.env.DATABASE_URL ?? "postgresql://build:build@localhost:5432/value_marka",
  },
});
