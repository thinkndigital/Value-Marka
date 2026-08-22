import "server-only";
import { randomUUID } from "node:crypto";
import { getStorageProvider } from "./index";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB

export class InvalidDigitalFileError extends Error {}

/**
 * Validates and persists an uploaded digital-product deliverable via
 * uploadPrivate() — never the public upload() catalog-image path. The
 * "digital-products/" prefix keeps these keys distinguishable from public
 * catalog assets for anyone auditing bucket contents/IAM.
 */
export async function uploadDigitalFile(
  file: File,
  sellerId: string,
): Promise<{ storageKey: string; fileName: string; fileSizeBytes: number; contentType: string }> {
  if (file.size === 0) {
    throw new InvalidDigitalFileError("The selected file is empty.");
  }
  if (file.size > MAX_BYTES) {
    throw new InvalidDigitalFileError("Digital files must be 200MB or smaller.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `digital-products/${sellerId}/${randomUUID()}`;
  const contentType = file.type || "application/octet-stream";

  await getStorageProvider().uploadPrivate({ key, buffer, contentType });

  return { storageKey: key, fileName: file.name, fileSizeBytes: file.size, contentType };
}
