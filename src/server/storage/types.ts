export interface UploadInput {
  /** Storage key, e.g. "products/<sellerId>/<uuid>.webp" */
  key: string;
  buffer: Buffer;
  contentType: string;
}

export interface UploadResult {
  key: string;
  url: string;
}

export interface StorageProvider {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  /**
   * Stores a file that must never be reachable by a public/guessable URL
   * (e.g. a digital product's deliverable). Unlike upload(), the returned
   * `url` is not meant to be shown to anyone — real access always goes
   * through getSignedDownloadUrl().
   */
  uploadPrivate(input: UploadInput): Promise<UploadResult>;
  /** A time-limited URL for a key previously stored via uploadPrivate(). */
  getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number,
    downloadFileName: string,
  ): Promise<string>;
}
