import "server-only";
import { cache } from "react";
import { prisma } from "@/server/db";
import { getSessionFromDb } from "./session";

/**
 * Data Access Layer entry point (per the Next.js auth guide): every data
 * request or Server Action that needs to know "who is this" calls through
 * here, never reads the cookie directly. `cache()` memoizes this for the
 * lifetime of a single render pass so multiple components can call it
 * without multiplying database round-trips.
 */
export const verifySession = cache(async () => {
  const session = await getSessionFromDb();
  if (!session) return null;
  return { isAuthenticated: true as const, userId: session.userId };
});

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  locale: true,
  status: true,
  createdAt: true,
  roles: {
    select: {
      sellerId: true,
      role: { select: { key: true, name: true } },
    },
  },
} as const;

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

/** Returns a DTO — never the passwordHash column — or null if signed out. */
export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: SAFE_USER_SELECT,
  });

  return user;
});
