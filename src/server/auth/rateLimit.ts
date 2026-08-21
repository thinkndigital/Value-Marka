import "server-only";
import { prisma } from "@/server/db";

const WINDOW_MS = 15 * 60 * 1000;

/**
 * DB-backed (not in-memory) so this holds up across Cloud Run's multiple
 * instances — an in-memory counter would reset per-instance and could be
 * trivially bypassed by hitting a different instance each request.
 * Returns true if the request is allowed (and records this attempt); false
 * if the identifier has already hit `max` attempts for `scope` within the
 * last 15 minutes, in which case nothing is recorded (an already-blocked
 * caller shouldn't be able to keep pushing its own window forward).
 */
export async function checkRateLimit(scope: string, identifier: string, max: number): Promise<boolean> {
  const key = `${scope}:${identifier}`;
  const since = new Date(Date.now() - WINDOW_MS);

  const count = await prisma.rateLimitAttempt.count({ where: { key, createdAt: { gte: since } } });
  if (count >= max) return false;

  await prisma.rateLimitAttempt.create({ data: { key } });
  return true;
}
