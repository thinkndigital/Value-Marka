import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import type { StorageProvider, UploadInput, UploadResult } from "./types";

const UPLOAD_ROOT = join(process.cwd(), "public", "uploads");
// Deliberately outside public/ — Next.js only serves files under public/,
// so anything written here has no URL at all except through the signed
// route handler below.
const PRIVATE_ROOT = join(process.cwd(), "private-uploads");

function resolveSafePath(root: string, key: string): string {
  const target = normalize(join(root, key));
  if (!target.startsWith(root)) {
    throw new Error("Invalid storage key.");
  }
  return target;
}

// Same signing approach as auth/token.ts's session cookie (jose SignJWT/
// jwtVerify) — reused here rather than hand-rolling a second HMAC scheme.
function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

interface DownloadTokenPayload {
  key: string;
  fileName: string;
  [claim: string]: unknown;
}

/** Used by the /api/downloads/local route handler to verify a request. */
export async function verifyLocalDownloadToken(
  token: string,
): Promise<DownloadTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    if (typeof payload.key !== "string" || typeof payload.fileName !== "string") return null;
    return payload as DownloadTokenPayload;
  } catch {
    return null;
  }
}

export function resolvePrivateFilePath(key: string): string {
  return resolveSafePath(PRIVATE_ROOT, key);
}

/**
 * Writes into public/uploads so Next.js serves the file statically at
 * /uploads/<key>. Local development only — see gcs.ts for production.
 */
export class LocalStorageProvider implements StorageProvider {
  async upload({ key, buffer }: UploadInput): Promise<UploadResult> {
    const path = resolveSafePath(UPLOAD_ROOT, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return { key, url: `/uploads/${key}` };
  }

  async delete(key: string): Promise<void> {
    const path = resolveSafePath(UPLOAD_ROOT, key);
    await unlink(path).catch(() => {
      // Already gone — deleting is still the correct outcome.
    });
  }

  async uploadPrivate({ key, buffer }: UploadInput): Promise<UploadResult> {
    const path = resolveSafePath(PRIVATE_ROOT, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return { key, url: "" }; // never a directly usable URL — see getSignedDownloadUrl
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number,
    downloadFileName: string,
  ): Promise<string> {
    const token = await new SignJWT({ key, fileName: downloadFileName })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${expiresInSeconds}s`)
      .sign(getSecretKey());
    return `/api/downloads/local?token=${encodeURIComponent(token)}`;
  }
}
