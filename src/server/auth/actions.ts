"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit";
import { redirect } from "@/i18n/navigation";
import { hashPassword, verifyPassword } from "./password";
import { createSession, deleteSession } from "./session";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "./schemas";
import { sendEmailNotification } from "@/server/notifications/send";
import { welcomeEmail } from "@/server/notifications/templates";
import { recordReferral } from "@/server/services/referrals";
import { checkRateLimit } from "./rateLimit";
import { requestPasswordReset, resetPassword, PasswordResetError } from "./passwordReset";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS_PER_IP = 20;
const MAX_REGISTER_ATTEMPTS_PER_IP = 10;
const MAX_PASSWORD_RESET_ATTEMPTS_PER_IP = 10;

export interface AuthFormState {
  errors?: Record<string, string[]>;
  formError?: string;
}

async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export async function registerAction(
  locale: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { firstName, lastName, email, password } = parsed.data;

  const meta = await requestMeta();
  if (meta.ipAddress) {
    const allowed = await checkRateLimit("register", meta.ipAddress, MAX_REGISTER_ATTEMPTS_PER_IP);
    if (!allowed) {
      return { formError: "Too many attempts. Please try again later." };
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["An account with this email already exists."] } };
  }

  const customerRole = await prisma.role.findUnique({
    where: { key: "CUSTOMER" },
  });
  if (!customerRole) {
    throw new Error(
      "CUSTOMER role is not seeded. Run `npm run db:seed` before accepting signups.",
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash,
      locale,
      roles: { create: { roleId: customerRole.id } },
    },
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "user.registered",
    entityType: "User",
    entityId: user.id,
    ipAddress: meta.ipAddress,
  });

  const welcome = welcomeEmail(user.firstName);
  sendEmailNotification({
    userId: user.id,
    to: user.email,
    type: "welcome",
    subject: welcome.subject,
    html: welcome.html,
  });

  const refCode = formData.get("ref");
  if (typeof refCode === "string" && refCode.trim()) {
    await recordReferral(user.id, refCode);
  }

  await createSession(user.id, meta);
  return redirect({ href: "/account", locale });
}

export async function loginAction(
  locale: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { email, password } = parsed.data;
  const meta = await requestMeta();
  const genericError = { formError: "That email and password don't match our records." };

  if (meta.ipAddress) {
    const allowed = await checkRateLimit("login", meta.ipAddress, MAX_LOGIN_ATTEMPTS_PER_IP);
    if (!allowed) {
      return { formError: "Too many attempts. Please try again later." };
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return genericError;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      formError: "Too many failed attempts. Please try again later.",
    };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      failedLoginAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MS)
        : null;

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts, lockedUntil },
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "user.login_failed",
      entityType: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
    });

    return genericError;
  }

  if (user.status !== "ACTIVE") {
    return { formError: "This account is not active. Contact support." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "user.login",
    entityType: "User",
    entityId: user.id,
    ipAddress: meta.ipAddress,
  });

  await createSession(user.id, meta);
  return redirect({ href: "/account", locale });
}

export async function logoutAction(locale: string) {
  await deleteSession();
  return redirect({ href: "/", locale });
}

export interface ForgotPasswordFormState {
  errors?: Record<string, string[]>;
  formError?: string;
  success?: boolean;
}

export async function forgotPasswordAction(
  locale: string,
  _prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  if (meta.ipAddress) {
    const allowed = await checkRateLimit(
      "password-reset-request",
      meta.ipAddress,
      MAX_PASSWORD_RESET_ATTEMPTS_PER_IP,
    );
    if (!allowed) {
      return { formError: "Too many attempts. Please try again later." };
    }
  }

  // Deliberately the same response whether or not the email is registered
  // (requestPasswordReset silently no-ops for an unknown email) — telling
  // the caller which emails have accounts is a real information leak.
  await requestPasswordReset(parsed.data.email, locale, meta.ipAddress);
  return { success: true };
}

export interface ResetPasswordFormState {
  errors?: Record<string, string[]>;
  formError?: string;
  success?: boolean;
}

export async function resetPasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  if (meta.ipAddress) {
    const allowed = await checkRateLimit(
      "password-reset-submit",
      meta.ipAddress,
      MAX_PASSWORD_RESET_ATTEMPTS_PER_IP,
    );
    if (!allowed) {
      return { formError: "Too many attempts. Please try again later." };
    }
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password, meta.ipAddress);
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return { formError: err.message };
    }
    throw err;
  }

  return { success: true };
}
