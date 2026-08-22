import "server-only";
import { Storage } from "@google-cloud/storage";
import type { StorageProvider, UploadInput, UploadResult } from "./types";

/**
 * Product/category/brand imagery is served from a public-read bucket (the
 * standard pattern for e-commerce catalog images — no benefit to signing
 * URLs for assets meant to be crawled and cached). Digital-product files
 * and other private documents go to `privateBucketName` instead — a
 * distinct bucket with no public IAM binding, per DEPLOYMENT.md §1.4. If
 * `privateBucketName` isn't configured, uploadPrivate()/
 * getSignedDownloadUrl() fall back to the public bucket, which — on a
 * bucket with uniform bucket-level access and the "allUsers: objectViewer"
 * binding DEPLOYMENT.md has an operator add for catalog images — is NOT
 * actually private, so that fallback throws instead of silently exposing
 * a file.
 */
export class GcsStorageProvider implements StorageProvider {
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly privateBucketName: string | undefined;

  constructor(bucketName: string, projectId?: string, privateBucketName?: string) {
    this.bucketName = bucketName;
    this.privateBucketName = privateBucketName;
    this.storage = new Storage(projectId ? { projectId } : undefined);
  }

  private requirePrivateBucket(): string {
    if (!this.privateBucketName) {
      throw new Error(
        "GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET is not set — a private, non-public bucket is required " +
          "to store or serve digital-product files securely. See DEPLOYMENT.md §1.4.",
      );
    }
    return this.privateBucketName;
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

  async uploadPrivate({ key, buffer, contentType }: UploadInput): Promise<UploadResult> {
    const bucketName = this.requirePrivateBucket();
    const file = this.storage.bucket(bucketName).file(key);
    await file.save(buffer, { contentType });
    return { key, url: `https://storage.googleapis.com/${bucketName}/${key}` };
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number,
    downloadFileName: string,
  ): Promise<string> {
    const bucketName = this.requirePrivateBucket();
    const [url] = await this.storage
      .bucket(bucketName)
      .file(key)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiresInSeconds * 1000,
        responseDisposition: `attachment; filename="${downloadFileName.replace(/"/g, "")}"`,
      });
    return url;
  }
}
