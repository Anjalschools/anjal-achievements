export const MAX_ASSET_DOWNLOAD_ATTEMPTS = 3;

export const isPermanentHttpStatus = (status: number): boolean =>
  status === 400 || status === 403 || status === 404 || status === 410;

export const isTransientHttpStatus = (status: number): boolean =>
  status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

export const isMissingHttpStatus = (status: number): boolean =>
  status === 404 || status === 410;

export class AssetDownloadHttpError extends Error {
  readonly httpStatus?: number;
  readonly permanent: boolean;
  readonly missing: boolean;

  constructor(message: string, httpStatus?: number) {
    super(message);
    this.httpStatus = httpStatus;
    this.permanent = httpStatus !== undefined ? isPermanentHttpStatus(httpStatus) : false;
    this.missing = httpStatus !== undefined ? isMissingHttpStatus(httpStatus) : false;
  }
}

export class AssetDownloadAbortError extends Error {
  constructor(message = "ASSET_DOWNLOAD_ABORTED") {
    super(message);
  }
}

export const isTransientDownloadError = (error: unknown): boolean => {
  if (error instanceof AssetDownloadAbortError) return false;
  if (error instanceof AssetDownloadHttpError) {
    if (error.missing || error.permanent) return false;
    if (error.httpStatus !== undefined) {
      return isTransientHttpStatus(error.httpStatus);
    }
    return false;
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return (
      code === "ECONNRESET" ||
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT" ||
      code === "EAI_AGAIN" ||
      code === "ENOTFOUND" ||
      error.message.includes("fetch failed") ||
      error.message.includes("network")
    );
  }

  return false;
};

export const toDownloadFailureReason = (error: unknown): string => {
  if (error instanceof AssetDownloadHttpError) {
    return error.httpStatus ? `HTTP_${error.httpStatus}` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};
