"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit";
import { redirect } from "@/i18n/navigation";
import { hashPassword, verifyPassword } from "./password";
import { createSession, deleteSession } from "./session";
import { loginSchema, registerSchema } from "./schemas";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

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
  const meta = await requestMeta();

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
