import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { checkRateLimit } from "@/server/auth/rateLimit";

// DB-backed rate limiting (Phase 10) — deliberately not in-memory, since an
// in-memory counter resets per Cloud Run instance. This checks the real
// counting/blocking behavior against the RateLimitAttempt table.

const PREFIX = "rate-limit-test-";

afterAll(async () => {
  await prisma.rateLimitAttempt.deleteMany({ where: { key: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("checkRateLimit", () => {
  it("allows requests up to the max, then blocks", async () => {
    const identifier = `${PREFIX}ip-a-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      const allowed = await checkRateLimit("login", identifier, 3);
      expect(allowed).toBe(true);
    }

    const blocked = await checkRateLimit("login", identifier, 3);
    expect(blocked).toBe(false);
  });

  it("does not record an attempt once already blocked", async () => {
    const identifier = `${PREFIX}ip-b-${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      await checkRateLimit("login", identifier, 2);
    }
    await checkRateLimit("login", identifier, 2); // blocked, should not record
    await checkRateLimit("login", identifier, 2); // blocked again, should not record

    const key = `login:${identifier}`;
    const count = await prisma.rateLimitAttempt.count({ where: { key } });
    expect(count).toBe(2);
  });

  it("scopes independently by scope and by identifier", async () => {
    const identifier = `${PREFIX}ip-c-${Date.now()}`;

    // Exhaust the "login" scope for this identifier.
    await checkRateLimit("login", identifier, 1);
    expect(await checkRateLimit("login", identifier, 1)).toBe(false);

    // A different scope for the same identifier is unaffected.
    expect(await checkRateLimit("register", identifier, 1)).toBe(true);

    // The same scope for a different identifier is unaffected.
    const otherIdentifier = `${PREFIX}ip-d-${Date.now()}`;
    expect(await checkRateLimit("login", otherIdentifier, 1)).toBe(true);
  });
});
