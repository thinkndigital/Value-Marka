import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { encryptSessionToken, decryptSessionToken } from "@/server/auth/token";
import { checkRateLimit } from "@/server/auth/rateLimit";

/**
 * A protected self-diagnosis endpoint, not a health check for uptime
 * monitoring — it exists so a real production error (DB connectivity, a
 * missing/short SESSION_SECRET, an unmigrated table) surfaces as plain
 * JSON in the browser instead of requiring a trip through the hosting
 * platform's runtime log UI, which on some platforms/plans is hard to
 * search or doesn't retain long enough to catch an error after the fact.
 * Gated on CRON_SECRET (already a trusted-caller secret in this app, see
 * /api/cron/*) via `?secret=` (for a browser address bar) or a Bearer
 * header — never returns real secret *values*, only which are present.
 */

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  error?: string;
  ms: number;
}

async function runCheck(name: string, fn: () => Promise<string | void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, detail: detail ?? undefined, ms: Date.now() - start };
  } catch (err) {
    return {
      name,
      ok: false,
      error: err instanceof Error ? `${err.message}${err.stack ? `\n${err.stack}` : ""}` : String(err),
      ms: Date.now() - start,
    };
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on this deployment." }, { status: 500 });
  }

  const url = new URL(request.url);
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? url.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const envPresence = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    SESSION_SECRET: Boolean(process.env.SESSION_SECRET) && (process.env.SESSION_SECRET?.length ?? 0) >= 32,
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Boolean(process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY),
    ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL),
    ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
    CRON_SECRET: true,
  };

  const checks: CheckResult[] = [];

  checks.push(
    await runCheck("database connectivity (SELECT 1)", async () => {
      await prisma.$queryRaw`SELECT 1`;
    }),
  );

  checks.push(
    await runCheck("core tables migrated", async () => {
      const [roles, users, cmsBlocks, rateLimitAttempts] = await Promise.all([
        prisma.role.count(),
        prisma.user.count(),
        prisma.cmsBlock.count(),
        prisma.rateLimitAttempt.count(),
      ]);
      return `roles=${roles} users=${users} cmsBlocks=${cmsBlocks} rateLimitAttempts=${rateLimitAttempts}`;
    }),
  );

  checks.push(
    await runCheck("bootstrap admin present", async () => {
      const superAdmins = await prisma.userRole.count({ where: { role: { key: "SUPER_ADMIN" } } });
      return `${superAdmins} SUPER_ADMIN grant(s)`;
    }),
  );

  checks.push(
    await runCheck("session token round-trip (same code path as login)", async () => {
      const token = await encryptSessionToken({ sessionId: "debug-check" });
      const payload = await decryptSessionToken(token);
      if (payload?.sessionId !== "debug-check") throw new Error("Round-trip produced a mismatched payload.");
    }),
  );

  checks.push(
    await runCheck("rate limiter write (same table login/register use)", async () => {
      const allowed = await checkRateLimit("debug-check", "debug", 1_000_000);
      if (!allowed) throw new Error("Unexpected: rate limit rejected a debug-scoped check.");
    }),
  );

  const ok = checks.every((c) => c.ok);
  return NextResponse.json({ ok, envPresence, checks, serverTime: new Date().toISOString() }, { status: ok ? 200 : 500 });
}
