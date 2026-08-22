import "server-only";
import { LocalStorageProvider } from "./local";
import { GcsStorageProvider } from "./gcs";
import type { StorageProvider } from "./types";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const bucket = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (bucket) {
    cached = new GcsStorageProvider(
      bucket,
      process.env.GOOGLE_CLOUD_PROJECT_ID,
      process.env.GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET,
    );
    return cached;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GOOGLE_CLOUD_STORAGE_BUCKET is not set. Local-disk storage is not " +
        "permitted in production (uploads would not survive a redeploy).",
    );
  }

  cached = new LocalStorageProvider();
  return cached;
}

export type { StorageProvider, UploadInput, UploadResult } from "./types";
