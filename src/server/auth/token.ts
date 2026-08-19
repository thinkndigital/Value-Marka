import { SignJWT, jwtVerify } from "jose";

// Deliberately no `server-only` / `next/headers` / Prisma imports here —
// this module is shared between session.ts (Server Components/Actions,
// which need the DB-backed session) and proxy.ts (which only ever does the
// cheap, cookie-only "optimistic" check per the Next.js auth guide).

export const SESSION_COOKIE_NAME = "vm_session";
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters.",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionCookiePayload {
  sessionId: string;
  [key: string]: unknown;
}

export async function encryptSessionToken(payload: SessionCookiePayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_LIFETIME_MS / 1000}s`)
    .sign(getSecretKey());
}

export async function decryptSessionToken(
  token: string | undefined,
): Promise<SessionCookiePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload as SessionCookiePayload;
  } catch {
    return null;
  }
}
