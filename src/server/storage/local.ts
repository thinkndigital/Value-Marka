import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import type { StorageProvider, UploadInput, UploadResult } from "./types";

const UPLOAD_ROOT = join(process.cwd(), "public", "uploads");

function resolveSafePath(key: string): string {
  const target = normalize(join(UPLOAD_ROOT, key));
  if (!target.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid storage key.");
  }
  return target;
}

/**
 * Writes into public/uploads so Next.js serves the file statically at
 * /uploads/<key>. Local development only — see gcs.ts for production.
 */
export class LocalStorageProvider implements StorageProvider {
  async upload({ key, buffer }: UploadInput): Promise<UploadResult> {
    const path = resolveSafePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return { key, url: `/uploads/${key}` };
  }

  async delete(key: string): Promise<void> {
    const path = resolveSafePath(key);
    await unlink(path).catch(() => {
      // Already gone — deleting is still the correct outcome.
    });
  }
}
