import { createHash } from "crypto";
import { createWriteStream } from "fs";
import { mkdir, rename, rm, stat } from "fs/promises";
import { dirname, join } from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";

import { fetchR2ObjectStream } from "@/lib/disaster-recovery-v2/object-storage/r2-client";
import type { R2Manifest, R2ManifestEntry } from "@/lib/disaster-recovery-v2/object-storage/r2-manifest";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export type R2ExportDependencies = {
  workspaceDir: string;
  jobId: string;
  getObject?: typeof fetchR2ObjectStream;
  ensureDirectory?: (directoryPath: string) => Promise<void>;
  removeFile?: (filePath: string) => Promise<void>;
  renameFile?: (sourcePath: string, destinationPath: string) => Promise<void>;
  statFile?: (filePath: string) => Promise<{ size: number }>;
};

export type R2ExportResult = {
  exported: number;
  failed: number;
  totalBytes: number;
  manifest: R2Manifest;
};

const isReadableBody = (body: unknown): body is Readable =>
  Boolean(body) && typeof (body as Readable).pipe === "function";

const createSha256Transform = (): { transform: Transform; digest: () => string } => {
  const hash = createHash("sha256");
  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  return {
    transform,
    digest: () => hash.digest("hex"),
  };
};

type AwsLikeExportError = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  stack?: unknown;
  $metadata?: {
    httpStatusCode?: unknown;
    requestId?: unknown;
    extendedRequestId?: unknown;
    cfId?: unknown;
  };
};

export type R2ExportErrorDetails = {
  errorName: string;
  errorMessage: string;
  errorCode?: string;
  httpStatusCode?: number;
  requestId?: string;
  extendedRequestId?: string;
  cfId?: string;
  stack?: string;
  diagnosticMessage: string;
};

const readNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readHttpStatusCode = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
};

export const extractR2ExportErrorDetails = (error: unknown): R2ExportErrorDetails => {
  if (error instanceof Error) {
    return parseAwsLikeExportError(error as Error & AwsLikeExportError);
  }

  if (error && typeof error === "object") {
    return parseAwsLikeExportError(error as AwsLikeExportError);
  }

  const fallbackMessage =
    typeof error === "string" && error.trim() ? error.trim() : "R2_EXPORT_FAILED";

  return {
    errorName: "Error",
    errorMessage: fallbackMessage,
    diagnosticMessage: fallbackMessage,
  };
};

const parseAwsLikeExportError = (record: AwsLikeExportError): R2ExportErrorDetails => {
  const errorName = readNonEmptyString(record.name) ?? "Error";
  const errorMessage = readNonEmptyString(record.message) ?? "R2_EXPORT_FAILED";
  const errorCode = readNonEmptyString(record.code);
  const httpStatusCode = readHttpStatusCode(record.$metadata?.httpStatusCode);
  const requestId = readNonEmptyString(record.$metadata?.requestId);
  const extendedRequestId = readNonEmptyString(record.$metadata?.extendedRequestId);
  const cfId = readNonEmptyString(record.$metadata?.cfId);
  const stack = readNonEmptyString(record.stack);
  const label = errorCode ?? errorName;

  const diagnosticMessage = httpStatusCode
    ? `${label} (${httpStatusCode}): ${errorMessage}`
    : `${label}: ${errorMessage}`;

  return {
    errorName,
    errorMessage,
    errorCode,
    httpStatusCode,
    requestId,
    extendedRequestId,
    cfId,
    stack,
    diagnosticMessage,
  };
};

const buildR2ExportVerificationError = (failed: R2ManifestEntry[]): Error => {
  const firstFailed = failed[0];
  const key = firstFailed?.key ?? "unknown";
  const bucket = firstFailed?.bucket ?? "unknown";
  const errorMessage = firstFailed?.errorMessage ?? "UNKNOWN";

  return new Error(
    `R2_EXPORT_VERIFICATION_FAILED:${failed.length}\nkey=${key}\nbucket=${bucket}\nerror=${errorMessage}`
  );
};

const exportSingleR2Object = async (
  entry: R2ManifestEntry,
  deps: R2ExportDependencies
): Promise<R2ManifestEntry> => {
  const ensureDirectory = deps.ensureDirectory ?? (async (path) => mkdir(path, { recursive: true }));
  const removeFile = deps.removeFile ?? (async (path) => rm(path, { force: true }));
  const renameFile = deps.renameFile ?? rename;
  const statFile = deps.statFile ?? stat;
  const getObject = deps.getObject ?? fetchR2ObjectStream;

  const absolutePath = join(deps.workspaceDir, entry.relativePath);
  const tempPath = `${absolutePath}.tmp`;
  const startedAt = Date.now();

  try {
    await ensureDirectory(dirname(absolutePath));
    await removeFile(tempPath).catch(() => undefined);

    const response = await getObject({ key: entry.key });
    if (!isReadableBody(response.Body)) {
      throw new Error("R2_OBJECT_EMPTY");
    }

    const { transform, digest } = createSha256Transform();
    const writeStream = createWriteStream(tempPath, { flags: "w" });

    await pipeline(response.Body, transform, writeStream);

    const fileStat = await statFile(tempPath);
    const sha256 = digest();

    if (entry.sha256 && entry.sha256 !== sha256) {
      throw new Error("R2_CHECKSUM_MISMATCH");
    }

    await renameFile(tempPath, absolutePath);

    logDrV2("R2_OBJECT_EXPORTED", {
      jobId: deps.jobId,
      key: entry.key,
      relativePath: entry.relativePath,
      sizeBytes: fileStat.size,
      durationMs: Date.now() - startedAt,
    });

    return {
      ...entry,
      size: fileStat.size,
      sha256,
      exportedAt: new Date().toISOString(),
      status: "exported",
    };
  } catch (error) {
    await removeFile(tempPath).catch(() => undefined);
    const durationMs = Date.now() - startedAt;
    const details = extractR2ExportErrorDetails(error);

    logDrV2("R2_OBJECT_EXPORT_FAILED", {
      jobId: deps.jobId,
      provider: "r2",
      bucket: entry.bucket,
      key: entry.key,
      relativePath: entry.relativePath,
      errorName: details.errorName,
      errorMessage: details.errorMessage,
      errorCode: details.errorCode,
      httpStatusCode: details.httpStatusCode,
      requestId: details.requestId,
      extendedRequestId: details.extendedRequestId,
      cfId: details.cfId,
      durationMs,
      message: details.diagnosticMessage,
      ...(details.stack ? { stack: details.stack } : {}),
    });

    return {
      ...entry,
      status: "failed",
      errorMessage: details.diagnosticMessage,
    };
  }
};

export const exportR2ObjectsFromManifest = async (
  manifest: R2Manifest,
  deps: R2ExportDependencies
): Promise<R2ExportResult> => {
  const nextObjects: R2ManifestEntry[] = [];
  let exported = 0;
  let failed = 0;
  let totalBytes = 0;

  for (const entry of manifest.objects) {
    const result = await exportSingleR2Object(entry, deps);
    nextObjects.push(result);

    if (result.status === "exported") {
      exported += 1;
      totalBytes += result.size ?? 0;
    } else {
      failed += 1;
    }
  }

  const nextManifest: R2Manifest = {
    ...manifest,
    objectCount: nextObjects.length,
    totalBytes,
    verified: failed === 0,
    objects: nextObjects,
  };

  return {
    exported,
    failed,
    totalBytes,
    manifest: nextManifest,
  };
};

export const verifyR2ManifestExport = (manifest: R2Manifest): void => {
  const failed = manifest.objects.filter((entry) => entry.status === "failed");
  if (failed.length > 0) {
    throw buildR2ExportVerificationError(failed);
  }
};
