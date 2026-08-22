import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { requestPasswordReset, resetPassword, PasswordResetError } from "@/server/auth/passwordReset";

const PREFIX = "password-reset-test-";

let userId: string;
let userEmail: string;

beforeAll(async () => {
  userEmail = `${PREFIX}${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email: userEmail,
      firstName: "Reset",
      lastName: "Tester",
      passwordHash: await hashPassword("Original-Pass1"),
    },
  });
  userId = user.id;

  await prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + 60_000) },
  });
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.verificationToken.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

function latestTokenRow(uid: string) {
  return prisma.verificationToken.findFirst({
    where: { userId: uid, type: "PASSWORD_RESET" },
    orderBy: { createdAt: "desc" },
  });
}

describe("password reset", () => {
  it("silently no-ops for an unknown email (no user enumeration)", async () => {
    await expect(
      requestPasswordReset("no-such-user@example.com", "en", null),
    ).resolves.toBeUndefined();
  });

  it("creates a real, hashed, expiring token for a known email — never stores the raw token", async () => {
    await requestPasswordReset(userEmail, "en", "203.0.113.5");

    const record = await latestTokenRow(userId);
    expect(record).not.toBeNull();
    expect(record!.usedAt).toBeNull();
    expect(record!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(record!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a second request invalidates the first token — only the newest link works", async () => {
    const first = await latestTokenRow(userId);

    await requestPasswordReset(userEmail, "en", "203.0.113.5");

    const stillThere = await prisma.verificationToken.findUnique({ where: { id: first!.id } });
    expect(stillThere).toBeNull();
  });

  it("rejects an unknown/garbage token", async () => {
    await expect(resetPassword("not-a-real-token", "New-Pass1", null)).rejects.toBeInstanceOf(
      PasswordResetError,
    );
  });

  it("rejects an expired token", async () => {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.verificationToken.create({
      data: {
        userId,
        type: "PASSWORD_RESET",
        tokenHash,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(resetPassword(rawToken, "New-Pass1", null)).rejects.toBeInstanceOf(PasswordResetError);
  });

  it("resets the password, invalidates the token, and signs out every session", async () => {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.verificationToken.create({
      data: {
        userId,
        type: "PASSWORD_RESET",
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await resetPassword(rawToken, "Brand-New-Pass1", null);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await expect(verifyPassword("Brand-New-Pass1", user.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("Original-Pass1", user.passwordHash)).resolves.toBe(false);

    const sessions = await prisma.session.findMany({ where: { userId } });
    expect(sessions).toHaveLength(0);

    const usedToken = await prisma.verificationToken.findUnique({ where: { tokenHash } });
    expect(usedToken?.usedAt).not.toBeNull();
  });

  it("won't let the same token be used twice", async () => {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.verificationToken.create({
      data: {
        userId,
        type: "PASSWORD_RESET",
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      },
    });

    await expect(resetPassword(rawToken, "Another-Pass1", null)).rejects.toBeInstanceOf(
      PasswordResetError,
    );
  });
});
