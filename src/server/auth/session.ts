import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import {
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_MS,
  encryptSessionToken,
  decryptSessionToken,
} from "./token";

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
) {
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: meta.userAgent ?? undefined,
      ipAddress: meta.ipAddress ?? undefined,
    },
  });

  const token = await encryptSessionToken({ sessionId: session.id });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return session;
}

/** Optimistic-only: decodes the cookie without hitting the database. */
export async function readSessionCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return decryptSessionToken(token);
}

/** Authoritative: confirms the session still exists and isn't expired. */
export async function getSessionFromDb() {
  const payload = await readSessionCookie();
  if (!payload?.sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

export async function deleteSession() {
  const payload = await readSessionCookie();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  if (payload?.sessionId) {
    await prisma.session
      .delete({ where: { id: payload.sessionId } })
      .catch(() => {
        // Already gone — deleting the cookie is still the correct outcome.
      });
  }
}
