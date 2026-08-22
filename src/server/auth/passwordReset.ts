import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/server/db";
import { hashPassword } from "./password";
import { writeAuditLog } from "@/server/audit";
import { sendEmailNotification } from "@/server/notifications/send";
import { passwordResetEmail } from "@/server/notifications/templates";

const TOKEN_LIFETIME_MS = 60 * 60 * 1000; // 1 hour

export class PasswordResetError extends Error {}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new PasswordResetError("NEXT_PUBLIC_APP_URL is not configured.");
  return url;
}

/**
 * Always succeeds from the caller's point of view whether or not the email
 * exists — the Server Action returns the same generic message either way
 * (never "no account with that email"), so this can't be used to probe
 * which emails are registered. Only sends anything, and only writes an
 * audit row, when a real matching user is found.
 */
export async function requestPasswordReset(email: string, locale: string, ipAddress: string | null) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  // Only the newest requested link should ever work.
  await prisma.verificationToken.deleteMany({
    where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null },
  });

  const rawToken = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      type: "PASSWORD_RESET",
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
    },
  });

  const resetUrl = `${appUrl()}/${locale}/reset-password/${rawToken}`;
  const template = passwordResetEmail(resetUrl);
  sendEmailNotification({
    userId: user.id,
    to: user.email,
    type: "password_reset",
    subject: template.subject,
    html: template.html,
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "user.password_reset_requested",
    entityType: "User",
    entityId: user.id,
    ipAddress,
  });
}

/** Throws PasswordResetError with a message safe to show the user (expired/used/invalid link — never leaks whose). */
export async function resetPassword(rawToken: string, newPassword: string, ipAddress: string | null) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.type !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) {
    throw new PasswordResetError("This reset link is invalid or has expired. Request a new one.");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // A password reset is a good moment to sign out every other session —
    // whoever just proved control of the account's email shouldn't leave
    // an attacker's earlier session (or their own on a lost device) alive.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  await writeAuditLog({
    actorId: record.userId,
    actorEmail: record.user.email,
    action: "user.password_reset_completed",
    entityType: "User",
    entityId: record.userId,
    ipAddress,
  });
}
