export const CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS = 3;

const PERMANENT_FAILURE_PATTERNS = [
  /CLOUDINARY_DOWNLOAD_FAILED:404/i,
  /DOWNLOAD_NOT_FOUND/i,
  /NOT_FOUND/i,
  /resource not found/i,
  /invalid public_id/i,
  /asset deleted/i,
  /No such file/i,
  /404/,
];

const TRANSIENT_FAILURE_PATTERNS = [
  /DOWNLOAD_DATA_STALLED/i,
  /DOWNLOAD_STREAM_STALLED/i,
  /DOWNLOAD_NO_FIRST_BYTE/i,
  /DOWNLOAD_EOF_MISSING/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /socket hang up/i,
  /AbortError/i,
  /premature close/i,
  /DOWNLOAD_INCOMPLETE/i,
  /DOWNLOAD_BODY_TRUNCATED/i,
  /DOWNLOAD_ABORTED/i,
  /DOWNLOAD_SOCKET_CLOSED/i,
  /EPIPE/i,
  /ECONNABORTED/i,
];

export const isPermanentCloudinaryFailure = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return PERMANENT_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
};

export const isTransientCloudinaryFailure = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  if (isPermanentCloudinaryFailure(error)) return false;
  return TRANSIENT_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
};

export const classifyMissingAssetReason = (error: unknown): import("@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry").MissingAssetReason => {
  const message = error instanceof Error ? error.message : String(error);
  if (isPermanentCloudinaryFailure(error)) {
    return "not_found";
  }
  if (/DOWNLOAD_DATA_STALLED|DOWNLOAD_STREAM_STALLED|DOWNLOAD_NO_FIRST_BYTE|DOWNLOAD_EOF_MISSING/i.test(message)) {
    return "download_stalled";
  }
  if (/ETIMEDOUT|DOWNLOAD_ABORTED|timeout/i.test(message)) {
    return "download_timeout";
  }
  return "network_failure";
};

export const toCloudinaryMissingAssetError = (error: unknown): Error => {
  const message = error instanceof Error ? error.message : String(error);
  const missingError = new Error(`CLOUDINARY_MISSING_ASSET:${message}`);
  if (error instanceof Error && error.stack) {
    missingError.stack = error.stack;
  }
  return missingError;
};

export const isCloudinaryMissingAssetError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("CLOUDINARY_MISSING_ASSET:");
};
