import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// A single PrismaClient per process. In `next dev`, module state survives
// hot reloads of route modules but not the dev-server process itself, so we
// stash the instance on `globalThis` to avoid exhausting Postgres
// connections by re-instantiating on every edit.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

/**
 * A lazy proxy, not `createPrismaClient()` called directly here — Next.js's
 * `next build` "collect page data" step imports every route module,
 * including ones that never actually run at build time (e.g. Route
 * Handlers gated on cookies/auth), just to inspect their config. On a
 * platform without DATABASE_URL available at build time (Vercel, unlike
 * this project's Docker build which sets a dummy one — see Dockerfile),
 * that import alone used to throw before a single request was ever
 * served. Real methods are bound to the real client so `this` is correct
 * inside Prisma's own internals (e.g. `$transaction`), not the proxy.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
