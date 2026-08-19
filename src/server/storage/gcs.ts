import "server-only";
import { Storage } from "@google-cloud/storage";
import type { StorageProvider, UploadInput, UploadResult } from "./types";

/**
 * Product/category/brand imagery is served from a public-read bucket (the
 * standard pattern for e-commerce catalog images — no benefit to signing
 * URLs for assets meant to be crawled and cached). Private documents (e.g.
 * seller KYC uploads, once that flow is built) belong in a separate,
 * private bucket using signed URLs instead of this provider.
 */
export class GcsStorageProvider implements StorageProvider {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(bucketName: string, projectId?: string) {
    this.bucketName = bucketName;
    this.storage = new Storage(projectId ? { projectId } : undefined);
  }

  async upload({ key, buffer, contentType }: UploadInput): Promise<UploadResult> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    });
    return { key, url: `https://storage.googleapis.com/${this.bucketName}/${key}` };
  }

  async delete(key: string): Promise<void> {
    await this.storage
      .bucket(this.bucketName)
      .file(key)
      .delete({ ignoreNotFound: true });
  }
}
