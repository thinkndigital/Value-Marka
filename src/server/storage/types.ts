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
}
