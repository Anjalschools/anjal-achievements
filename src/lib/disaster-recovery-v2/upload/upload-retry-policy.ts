export const MAX_UPLOAD_ATTEMPTS = 2;

export class UploadProviderError extends Error {
  readonly httpStatus?: number;
  readonly permanent: boolean;

  constructor(message: string, options?: { httpStatus?: number; permanent?: boolean }) {
    super(message);
    this.httpStatus = options?.httpStatus;
    this.permanent = options?.permanent ?? false;
  }
}

export const isPermanentUploadError = (error: unknown): boolean => {
  if (error instanceof UploadProviderError) {
    return error.permanent || error.httpStatus === 401 || error.httpStatus === 403;
  }

  if (error instanceof Error) {
    const message = error.message;
    return (
      message.includes("Missing S3 credentials") ||
      message.includes("Missing endpoint") ||
      message.includes("Missing bucket") ||
      message.includes("Invalid R2") ||
      message.includes("UPLOAD_CHECKSUM_MISMATCH") ||
      message.includes("UPLOAD_SIZE_MISMATCH") ||
      message.includes("UPLOAD_BYTE_COUNT_MISMATCH") ||
      message.includes("AccessDenied") ||
      message.includes("Unauthorized") ||
      message.includes("InvalidAccessKeyId")
    );
  }

  return false;
};

export const isTransientUploadError = (error: unknown): boolean => {
  if (isPermanentUploadError(error)) return false;

  if (error instanceof UploadProviderError) {
    if (error.httpStatus === undefined) return true;
    return [408, 429, 500, 502, 503, 504].includes(error.httpStatus);
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return (
      code === "ECONNRESET" ||
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT" ||
      code === "EAI_AGAIN" ||
      error.message.includes("fetch failed") ||
      error.message.includes("timeout") ||
      error.message.includes("ServiceUnavailable")
    );
  }

  return true;
};

export const toUploadFailureReason = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};
