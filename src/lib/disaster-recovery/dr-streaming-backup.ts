import "server-only";
import { PassThrough, type Readable } from "stream";
import { serializeManifest, type BackupManifest } from "@/lib/backup/backup-manifest";
import type { BackupPackageEntry } from "@/lib/backup/backup-zip";
import { createZipArchiveWriter } from "@/lib/backup/backup-zip";
import {
  resolveBackupStorageProvider,
  type StoredBackupArtifact,
} from "@/lib/backup/backup-storage";
import type { BackupStorageProviderId } from "@/lib/backup/backup-constants";
import {
  DR_UPLOAD_COMPLETE_TIMEOUT_MS,
  withDrTimeout,
} from "@/lib/disaster-recovery/dr-async-timeout";
import { logDr, logDrExportMemorySnapshot, logDrMemory } from "@/lib/disaster-recovery/dr-backup-logging";
import { truncateDrErrorStack } from "@/lib/disaster-recovery/dr-diag-policy";
import { DrExportWatchdog } from "@/lib/disaster-recovery/dr-export-watchdog";
import { updateDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import {
  destroyDrStream,
  logDrObjectDiag,
  monitorDrStream,
} from "@/lib/disaster-recovery/dr-stream-lifecycle";
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
import {
  logDrMilestone,
  trackDrPromise,
  updateDrVerificationReport,
  verifyArchiveLifecycle,
} from "@/lib/disaster-recovery/dr-verification";
import { logDrStartupMilestone } from "@/lib/disaster-recovery/dr-job-startup";
import { logDrArchiveAppendFailed } from "@/lib/disaster-recovery/dr-object-stream-diagnostics";
import {
  registerDrArchiverDiagnostics,
  registerDrR2UploadDiagnostics,
} from "@/lib/disaster-recovery/dr-leak-detection";

const logStreamingError = (phase: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[DR] STREAMING_ERROR ${phase}`, { message, stack: truncateDrErrorStack(error) });
};

const logStorageUploadFailed = (provider: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[DR] STORAGE_UPLOAD_FAILED", { provider, message, stack: truncateDrErrorStack(error) });
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
  logDrStartupMilestone("STREAMING_BACKUP_ENTER", {
    inventoryCount: input.inventory.length,
    fileName: input.fileName,
  });

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

  const zipOutput = new PassThrough();
  const uploadBody = new PassThrough();
  zipOutput.pipe(uploadBody);

  monitorDrStream(zipOutput, { objectKey: input.fileName, stage: "zip-upload" });
  let uploadCompletedFlag = false;
  registerDrR2UploadDiagnostics(() => ({
    bodyStreamDestroyed: uploadBody.destroyed,
    bodyStreamReadableEnded: uploadBody.readableEnded,
    bodyStreamClosed: Boolean((uploadBody as { closed?: boolean }).closed),
    uploadCompleted: uploadCompletedFlag,
  }));
  const storage = resolveBackupStorageProvider(effectiveProvider);
  const fileName = input.fileName;

  console.log("[DR] STORAGE_UPLOAD_START", {
    provider: effectiveProvider,
    fileName,
    archivePointer: 0,
    usesStreamingUpload: true,
  });

  logDrObjectDiag("Upload stream started", {
    objectKey: fileName,
    provider: effectiveProvider,
    uploadReadableFlowing: uploadBody.readableFlowing,
  });
  logDrMilestone("UPLOAD_STARTED", { fileName, provider: effectiveProvider });
  const uploadStartedAt = Date.now();
  const storePromise = trackDrPromise(
    "storageUploadComplete",
    withDrTimeout(
      storage.storeStream!({
        fileName,
        body: uploadBody,
        contentType: "application/zip",
      }).then((stored) => {
        logDrObjectDiag("Upload stream finished", {
          objectKey: fileName,
          provider: stored.provider,
          sizeBytes: stored.sizeBytes,
        });
        return { stored, zipBuffer: undefined as Buffer | undefined };
      }),
      DR_UPLOAD_COMPLETE_TIMEOUT_MS,
      "storageUploadComplete",
      { objectKey: fileName }
    )
  );

  let writer: Awaited<ReturnType<typeof createZipArchiveWriter>>;
  try {
    console.log("[DR] BEFORE createZipArchiveWriter");
    writer = await createZipArchiveWriter(zipOutput);
    if (writer.getArchiveDiagnostics) {
      registerDrArchiverDiagnostics(writer.getArchiveDiagnostics);
    }
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
  let activeObjectStream: Readable | null = null;

  const watchdog = new DrExportWatchdog({
    onStall: (snapshot) => {
      const stallError = new Error(
        `DR_WATCHDOG_STALL:last=${snapshot.lastArchivePath ?? "unknown"}:idle=${Date.now() - snapshot.lastProgressAt}ms`
      );
      logDrObjectDiag("Watchdog abort", {
        ...snapshot,
        message: stallError.message,
      });
      destroyDrStream(activeObjectStream ?? undefined, stallError);
      zipOutput.destroy(stallError);
      uploadBody.destroy(stallError);
    },
  });
  watchdog.start();

  let manifestEntries: StorageManifestEntry[];
  let failures: StorageManifestEntry[];
  let bytesExported: number;

  try {
    console.log("[DR] BEFORE exportStorageObjectsStreamExport", { inventory: input.inventory.length });
    logDrStartupMilestone("OBJECT_EXPORT_STARTED", {
      inventoryCount: input.inventory.length,
    });
    const exportResult = await exportStorageObjectsStreamExport({
      entries: input.inventory,
      guards: { watchdog },
      onObjectReady: async ({ stream, archivePath }) => {
        processedObjectCount += 1;
        activeObjectStream = stream;
        updateDrJobContext({
          processedObjects: processedObjectCount,
          archivePointer: writer.pointer(),
        });

        const shouldLogMemory =
          processedObjectCount % 100 === 0 || processedObjectCount === input.inventory.length;
        if (shouldLogMemory) {
          logDrExportMemorySnapshot(processedObjectCount);
          logDrMemory("memory:before-object", processedObjectCount);
        }

        liveObjectStreams += 1;
        maxLiveObjectStreams = Math.max(maxLiveObjectStreams, liveObjectStreams);
        try {
          await writer.append(stream, { name: archivePath });
        } catch (error) {
          logDrArchiveAppendFailed(
            {
              provider: "zip",
              archivePath,
              storageKey: archivePath,
              streamName: "dr-streaming-zip-append",
            },
            error
          );
          throw error;
        } finally {
          liveObjectStreams -= 1;
          activeObjectStream = null;
        }

        updateDrJobContext({ archivePointer: writer.pointer() });

        if (shouldLogMemory) {
          logDrExportMemorySnapshot(processedObjectCount);
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
          logDrExportMemorySnapshot(progress.processed);
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
    updateDrVerificationReport({
      objectsProcessed: manifestEntries.length,
      objectsFailed: failures.length,
      bytesExported,
    });
    logDrMilestone("OBJECT_EXPORT_COMPLETED", {
      exported: manifestEntries.length,
      failed: failures.length,
      bytesExported,
    });
  } catch (error) {
    logStreamingError("object-export", error);
    logStorageUploadFailed(effectiveProvider, error);
    throw error;
  } finally {
    watchdog.stop();
    destroyDrStream(activeObjectStream ?? undefined);
    activeObjectStream = null;
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
    logDrMilestone("ZIP_FINALIZE_STARTED", { pointer: writer.pointer() });
    await writer.finalize();
    if (writer.getArchiveState) {
      await verifyArchiveLifecycle({
        getArchiveState: writer.getArchiveState,
        output: zipOutput,
      });
    }
    if (writer.getArchiveDiagnostics) {
      registerDrArchiverDiagnostics(writer.getArchiveDiagnostics);
    }
    updateDrVerificationReport({ zipFinalized: true });
    logDrMilestone("ZIP_FINALIZE_COMPLETED", { pointer: writer.pointer() });
    console.log("[DR] AFTER archive.finalize", { pointer: writer.pointer() });
  } catch (error) {
    logStreamingError("archive.finalize", error);
    logStorageUploadFailed(effectiveProvider, error);
    const destroyError = error instanceof Error ? error : new Error(String(error));
    zipOutput.destroy(destroyError);
    uploadBody.destroy(destroyError);
    throw error;
  }

  let stored: StoredBackupArtifact;
  let zipBuffer: Buffer | undefined;
  try {
    console.log("[DR] BEFORE await storePromise", { archivePointer: writer.pointer() });
    const storeResult = await storePromise;
    stored = storeResult.stored;
    zipBuffer = storeResult.zipBuffer;
    uploadCompletedFlag = true;
    const uploadElapsedMs = Date.now() - uploadStartedAt;
    updateDrVerificationReport({ uploadCompleted: true });
    logDrMilestone("UPLOAD_COMPLETED", {
      provider: stored.provider,
      fileName: stored.fileName,
      sizeBytes: stored.sizeBytes,
      elapsedMs: uploadElapsedMs,
    });
    if (stored.provider === "r2") {
      logDrMilestone("R2_UPLOAD_COMPLETED", {
        bucket: stored.bucket,
        key: stored.storageKey,
        size: stored.sizeBytes,
        etag: stored.etag,
        elapsedMs: uploadElapsedMs,
      });
    }
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
