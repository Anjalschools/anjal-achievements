import { AssetDownloadHttpError } from "@/lib/disaster-recovery-v2/storage/asset-download/retry-policy";

export type AssetDownloadTransportResult = {
  contentLength?: number;
  bytesWritten: number;
};

export type AssetDownloadTransport = {
  download: (input: {
    url: string;
    tempPath: string;
    signal: AbortSignal;
  }) => Promise<AssetDownloadTransportResult>;
};

export const createFetchAssetDownloadTransport = (): AssetDownloadTransport => ({
  download: async ({ url, tempPath, signal }) => {
    const { mkdir, writeFile } = await import("fs/promises");
    const { dirname } = await import("path");

    await mkdir(dirname(tempPath), { recursive: true });

    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new AssetDownloadHttpError(`HTTP_${response.status}`, response.status);
    }

    const contentLengthHeader = response.headers.get("content-length");
    const parsedContentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
    const contentLength =
      parsedContentLength !== undefined && Number.isFinite(parsedContentLength)
        ? parsedContentLength
        : undefined;

    const arrayBuffer = await response.arrayBuffer();
    if (signal.aborted) {
      throw new Error("ASSET_DOWNLOAD_ABORTED");
    }

    const buffer = Buffer.from(arrayBuffer);
    await writeFile(tempPath, buffer);

    return {
      contentLength,
      bytesWritten: buffer.byteLength,
    };
  },
});
