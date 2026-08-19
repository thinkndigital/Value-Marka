import "server-only";
import { randomUUID } from "node:crypto";
import { getStorageProvider } from "./index";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class InvalidImageError extends Error {}

/**
 * Validates and persists an uploaded image via the configured
 * StorageProvider. Used by category/brand/product image forms.
 */
export async function uploadImage(
  file: File,
  keyPrefix: string,
): Promise<{ key: string; url: string }> {
  if (file.size === 0) {
    throw new InvalidImageError("The selected file is empty.");
  }
  if (file.size > MAX_BYTES) {
    throw new InvalidImageError("Images must be 5MB or smaller.");
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    throw new InvalidImageError(
      "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${keyPrefix}/${randomUUID()}.${extension}`;

  return getStorageProvider().upload({
    key,
    buffer,
    contentType: file.type,
  });
}
