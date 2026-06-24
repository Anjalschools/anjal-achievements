import "server-only";
import { PassThrough } from "stream";
import { serializeManifest, type BackupManifest } from "@/lib/backup/backup-manifest";
import type { BackupPackageEntry } from "@/lib/backup/backup-zip";
import { createZipArchiveWriter } from "@/lib/backup/backup-zip";
import {
  resolveBackupStorageProvider,
  type StoredBackupArtifact,
} from "@/lib/backup/backup-storage";
import type { BackupStorageProviderId } from "@/lib/backup/backup-constants";
import { logDr, logDrMemory } from "@/lib/disaster-recovery/dr-backup-logging";
import { updateDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { exportStorageObjectsStreamExport } from "@/lib/disaster-recovery/object-export";
import {
  serializeStorageManifest,
  STORAGE_MANIFEST_VERSION,
  type StorageManifestEntry,
} from "@/lib/disaster-recovery/storage-manifest-types";
import { summarizeStorageManifest } from "@/lib/disaster-recovery/dr-validation";
import {
  assertDisasterRecoveryStreamingUpload,
  resolveDisasterRecoveryStorageProvider,
} from "@/lib/disaster-recovery/dr-storage-resolution";

const logStreamingError = (phase: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[DR] STREAMING_ERROR ${phase}`, { message, stack });
};

const logStorageUploadFailed = (provider: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[DR] STORAGE_UPLOAD_FAILED", { provider, message, stack });
};

export type StreamingDisasterRecoveryZipResult = {
  stored: StoredBackupArtifact;
  zipBuffer?: Buffer;
  fileName: string;
  manifestWithChecksums: BackupManifest;
  objectCount: number;
  objectSizeBytes: number;
  recoveryReadinessScore: number;
  exportedCount: number;
  failedCount: number;
};

export const buildAndStoreStreamingDisasterRecoveryZip = async (input: {
  manifest: BackupManifest;
  entries: BackupPackageEntry[];
  inventory: StorageManifestEntry[];
  fileName: string;
  storageProvider: BackupStorageProviderId;
}): Promise<StreamingDisasterRecoveryZipResult> => {
  const storageResolution = resolveDisasterRecoveryStorageProvider({
    requested: input.storageProvider,
    includeObjects: true,
    source: "dr-streaming-backup",
  });
  const effectiveProvider = storageResolution.resolved;
  assertDisasterRecoveryStreamingUpload({
    storageProvider: effectiveProvider,
    source: "dr-streaming-backup",
  });

  console.log("[DR] BEFORE STREAMING ZIP");
  logDrMemory("memory:before-export");

  const output = new PassThrough();
  const storage = resolveBackupStorageProvider(effectiveProvider);
  const fileName = input.fileName;

  console.log("[DR] STORAGE_UPLOAD_START", {
    provider: effectiveProvider,
    fileName,
    archivePointer: 0,
    usesStreamingUpload: true,
  });

  const storePromise = storage.storeStream!({
    fileName,
    body: output,
    contentType: "application/zip",
  }).then((stored) => ({ stored, zipBuffer: undefined as Buffer | undefined }));

  let writer: Awaited<ReturnType<typeof createZipArchiveWriter>>;
  try {
    console.log("[DR] BEFORE createZipArchiveWriter");
    writer = await createZipArchiveWriter(output);
    console.log("[DR] AFTER createZipArchiveWriter");
  } catch (error) {
    logStreamingError("createZipArchiveWriter", error);
    logStorageUploadFailed(effectiveProvider, error);
    throw error;
  }

  try {
    console.log("[DR] BEFORE append collections", { count: input.entries.length });
    for (const entry of input.entries) {
      await writer.append(entry.content, { name: entry.fileName });
    }
    console.log("[DR] AFTER append collections");
  } catch (error) {
    logStreamingError("append-collections", error);
    logStorageUploadFailed(effectiveProvider, error);
    throw error;
  }

  let maxLiveObjectStreams = 0;
  let liveObjectStreams = 0;
  let processedObjectCount = 0;

  let manifestEntries: StorageManifestEntry[];
  let failures: StorageManifestEntry[];
  let bytesExported: number;

  try {
    console.log("[DR] BEFORE exportStorageObjectsStreamExport", { inventory: input.inventory.length });
    const exportResult = await exportStorageObjectsStreamExport({
      entries: input.inventory,
      onObjectReady: async ({ stream, archivePath }) => {
        processedObjectCount += 1;
        updateDrJobContext({
          processedObjects: processedObjectCount,
          archivePointer: writer.pointer(),
        });

        const shouldLogMemory =
          processedObjectCount % 100 === 0 || processedObjectCount === input.inventory.length;
        if (shouldLogMemory) {
          logDrMemory("memory:before-object", processedObjectCount);
        }

        liveObjectStreams += 1;
        maxLiveObjectStreams = Math.max(maxLiveObjectStreams, liveObjectStreams);
        try {
          await writer.append(stream, { name: archivePath });
        } finally {
          liveObjectStreams -= 1;
        }

        updateDrJobContext({ archivePointer: writer.pointer() });

        if (shouldLogMemory) {
          logDrMemory("memory:after-object", processedObjectCount);
        }
      },
      onProgress: (progress) => {
        updateDrJobContext({
          processedObjects: progress.processed,
          archivePointer: writer.pointer(),
        });
        if (progress.processed % 100 === 0 || progress.remaining === 0) {
          logDr("export-progress", {
            ...progress,
            maxLiveObjectStreams,
            archivePointer: writer.pointer(),
          });
          logDrMemory("memory:during-export", progress.processed);
        }
      },
    });
    manifestEntries = exportResult.manifestEntries;
    failures = exportResult.failures;
    bytesExported = exportResult.bytesExported;
    console.log("[DR] AFTER exportStorageObjectsStreamExport", {
      exported: manifestEntries.length,
      failed: failures.length,
    });
  } catch (error) {
    logStreamingError("object-export", error);
    logStorageUploadFailed(effectiveProvider, error);
    throw error;
  }

  logDr("stream-export:summary", { maxLiveObjectStreams });

  const mergedEntries = [...manifestEntries, ...failures];
  const summary = summarizeStorageManifest(mergedEntries);
  const checksums = Object.fromEntries(
    input.entries.map((entry) => [entry.collectionKey, entry.checksum])
  );
  const manifestWithChecksums: BackupManifest = {
    ...input.manifest,
    checksums,
    objectCount: summary.objectCount,
    objectSizeBytes: summary.totalBytes || bytesExported,
  };

  try {
    console.log("[DR] BEFORE append manifests");
    await writer.append(Buffer.from(serializeManifest(manifestWithChecksums), "utf8"), {
      name: "manifest.json",
    });
    await writer.append(
      Buffer.from(
        serializeStorageManifest({
          version: STORAGE_MANIFEST_VERSION,
          createdAt: new Date().toISOString(),
          ...summary,
          entries: mergedEntries,
        }),
        "utf8"
      ),
      { name: "storage-manifest.json" }
    );
    console.log("[DR] AFTER append manifests");
  } catch (error) {
    logStreamingError("append-manifests", error);
    logStorageUploadFailed(effectiveProvider, error);
    throw error;
  }

  try {
    console.log("[DR] BEFORE archive.finalize");
    await writer.finalize();
    console.log("[DR] AFTER archive.finalize", { pointer: writer.pointer() });
  } catch (error) {
    logStreamingError("archive.finalize", error);
    logStorageUploadFailed(effectiveProvider, error);
    throw error;
  }

  let stored: StoredBackupArtifact;
  let zipBuffer: Buffer | undefined;
  try {
    console.log("[DR] BEFORE await storePromise", { archivePointer: writer.pointer() });
    const storeResult = await storePromise;
    stored = storeResult.stored;
    zipBuffer = storeResult.zipBuffer;
    console.log("[DR] STORAGE_UPLOAD_COMPLETE", {
      provider: stored.provider,
      fileName: stored.fileName,
      sizeBytes: stored.sizeBytes,
      archivePointer: writer.pointer(),
    });
  } catch (error) {
    logStreamingError("storePromise", error);
    logStorageUploadFailed(effectiveProvider, error);
    throw error;
  }

  logDrMemory("memory:after-export");
  console.log("[DR] AFTER STREAMING ZIP");

  const recoveryReadinessScore = Math.round(
    (summary.exportedCount / Math.max(1, summary.objectCount)) * 100
  );

  return {
    stored,
    zipBuffer,
    fileName,
    manifestWithChecksums,
    objectCount: summary.objectCount,
    objectSizeBytes: summary.totalBytes || bytesExported,
    recoveryReadinessScore,
    exportedCount: summary.exportedCount,
    failedCount: summary.failedCount,
  };
};
