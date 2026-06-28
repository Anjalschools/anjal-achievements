export type UploadArtifact = {
  path: string;
  sha256: string;
  size: number;
  filename: string;
};

export type UploadResult = {
  provider: string;
  objectKey: string;
  etag?: string;
  uploadedBytes: number;
  completedAt: Date;
};

export type UploadReport = {
  provider: string;
  filename: string;
  bytes: number;
  sha256: string;
  uploadedAt: string;
  objectKey: string;
  etag?: string;
  durationMs: number;
};
