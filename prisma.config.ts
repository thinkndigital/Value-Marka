import { defineConfig, env } from "prisma/config";

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
    url: env("DATABASE_URL"),
  },
});
