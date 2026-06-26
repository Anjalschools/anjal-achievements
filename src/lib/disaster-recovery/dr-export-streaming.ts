import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";
import type { Readable } from "stream";
import {
  DR_OBJECT_DOWNLOAD_TIMEOUT_MS,
  DR_STREAM_COMPLETED_TIMEOUT_MS,
  DR_STREAM_DRAIN_TIMEOUT_MS,
  withDrTimeout,
} from "@/lib/disaster-recovery/dr-async-timeout";
import type { DrExportWatchdog } from "@/lib/disaster-recovery/dr-export-watchdog";
import {
  buildDrObjectStreamContext,
  logDrArchiveAppendFailed,
  logDrDownloadProviderFailed,
} from "@/lib/disaster-recovery/dr-object-stream-diagnostics";
import { destroyDrStream, logDrObjectDiag } from "@/lib/disaster-recovery/dr-stream-lifecycle";

export type StreamingObjectExportProgress = {
  processed: number;
  remaining: number;
  bytesExported: number;
};

export type StreamingObjectExportResult = {
  manifestEntries: StorageManifestEntry[];
  failures: StorageManifestEntry[];
  bytesExported: number;
};

export type ExportedObjectPayload = {
  entry: StorageManifestEntry;
  content: Buffer;
};

export type ExportedObjectStreamPayload = {
  stream: Readable;
  completed: Promise<StorageManifestEntry>;
  archivePath: string;
};

export type DrStreamExportGuards = {
  downloadTimeoutMs?: number;
  appendDrainTimeoutMs?: number;
  completedTimeoutMs?: number;
  watchdog?: DrExportWatchdog;
};

export const runSequentialObjectExport = async (input: {
  entries: StorageManifestEntry[];
  exportObject: (entry: StorageManifestEntry) => Promise<ExportedObjectPayload>;
  onObjectReady: (payload: ExportedObjectPayload) => Promise<void> | void;
  onProgress?: (progress: StreamingObjectExportProgress) => void;
}): Promise<StreamingObjectExportResult> => {
  const manifestEntries: StorageManifestEntry[] = [];
  const failures: StorageManifestEntry[] = [];
  let bytesExported = 0;
  const total = input.entries.length;

  for (let index = 0; index < input.entries.length; index += 1) {
    const source = input.entries[index];
    if (!source) continue;

    try {
      const exported = await input.exportObject(source);
      await input.onObjectReady(exported);
      manifestEntries.push(exported.entry);
      bytesExported += exported.content.byteLength;
    } catch (error) {
      failures.push({
        ...source,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "EXPORT_FAILED",
      });
    }

    const processed = index + 1;
    input.onProgress?.({
      processed,
      remaining: total - processed,
      bytesExported,
    });
  }

  return { manifestEntries, failures, bytesExported };
};

export const runSequentialObjectStreamExport = async (input: {
  entries: StorageManifestEntry[];
  exportObjectStream: (entry: StorageManifestEntry) => Promise<ExportedObjectStreamPayload>;
  onObjectReady: (payload: ExportedObjectStreamPayload) => Promise<void> | void;
  onProgress?: (progress: StreamingObjectExportProgress) => void;
  guards?: DrStreamExportGuards;
}): Promise<StreamingObjectExportResult> => {
  const manifestEntries: StorageManifestEntry[] = [];
  const failures: StorageManifestEntry[] = [];
  let bytesExported = 0;
  const total = input.entries.length;

  const downloadTimeoutMs = input.guards?.downloadTimeoutMs ?? DR_OBJECT_DOWNLOAD_TIMEOUT_MS;
  const appendDrainTimeoutMs = input.guards?.appendDrainTimeoutMs ?? DR_STREAM_DRAIN_TIMEOUT_MS;
  const completedTimeoutMs = input.guards?.completedTimeoutMs ?? DR_STREAM_COMPLETED_TIMEOUT_MS;

  for (let index = 0; index < input.entries.length; index += 1) {
    const source = input.entries[index];
    if (!source) continue;

    const objectKey = source.archivePath;
    const streamContext = buildDrObjectStreamContext({ entry: source });
    let activeStream: Readable | null = null;
    const objectStartedAt = Date.now();

    try {
      logDrObjectDiag("Object started", {
        objectKey,
        entryId: source.id,
        provider: source.provider,
        index: index + 1,
        total,
      });

      input.guards?.watchdog?.touch({
        lastEntryId: source.id,
        lastArchivePath: objectKey,
        lastPhase: "download",
        processedObjects: index,
      });

      const exported = await withDrTimeout(
        input.exportObjectStream(source),
        downloadTimeoutMs,
        "objectDownloadOpen",
        { objectKey }
      );
      activeStream = exported.stream;

      logDrObjectDiag("Download started", {
        objectKey,
        entryId: source.id,
        provider: source.provider,
      });

      input.guards?.watchdog?.touch({
        lastEntryId: source.id,
        lastArchivePath: objectKey,
        lastPhase: "archive-append",
        processedObjects: index,
      });

      logDrObjectDiag("Archive append started", { objectKey, entryId: source.id });
      const appendStartedAt = Date.now();
      const appendPromise = Promise.resolve(
        input.onObjectReady({
          stream: exported.stream,
          completed: exported.completed,
          archivePath: source.archivePath,
        })
      );
      try {
        await withDrTimeout(appendPromise, appendDrainTimeoutMs, "archiveAppendDrain", { objectKey });
      } catch (error) {
        logDrArchiveAppendFailed(streamContext, error);
        destroyDrStream(activeStream, error instanceof Error ? error : undefined);
        void appendPromise.catch(() => undefined);
        failures.push({
          ...source,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "EXPORT_FAILED",
        });
        logDrObjectDiag("Object failed", {
          objectKey,
          entryId: source.id,
          message: error instanceof Error ? error.message : String(error),
          elapsedMs: Date.now() - objectStartedAt,
        });
        continue;
      }
      logDrObjectDiag("Archive append finished", {
        objectKey,
        entryId: source.id,
        elapsedMs: Date.now() - appendStartedAt,
      });

      input.guards?.watchdog?.touch({
        lastEntryId: source.id,
        lastArchivePath: objectKey,
        lastPhase: "stream-completed",
        processedObjects: index,
      });

      const finalizedEntry = await withDrTimeout(
        exported.completed,
        completedTimeoutMs,
        "streamHashCompleted",
        { objectKey }
      );
      manifestEntries.push(finalizedEntry);
      bytesExported += finalizedEntry.fileSize || 0;

      logDrObjectDiag("Object finished", {
        objectKey,
        entryId: source.id,
        fileSize: finalizedEntry.fileSize,
        elapsedMs: Date.now() - objectStartedAt,
      });
    } catch (error) {
      logDrDownloadProviderFailed(streamContext, error);
      destroyDrStream(activeStream, error instanceof Error ? error : undefined);
      failures.push({
        ...source,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "EXPORT_FAILED",
      });
      logDrObjectDiag("Object failed", {
        objectKey,
        entryId: source.id,
        message: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - objectStartedAt,
      });
    } finally {
      activeStream = null;
    }

    const processed = index + 1;
    input.guards?.watchdog?.touch({
      lastEntryId: source.id,
      lastArchivePath: objectKey,
      lastPhase: "progress",
      processedObjects: processed,
    });
    input.onProgress?.({
      processed,
      remaining: total - processed,
      bytesExported,
    });
  }

  return { manifestEntries, failures, bytesExported };
};

export async function* exportStorageObjectsStreamingSource(
  entries: StorageManifestEntry[],
  exportObjectStream: (entry: StorageManifestEntry) => Promise<ExportedObjectStreamPayload>
): AsyncGenerator<ExportedObjectStreamPayload, void, void> {
  for (const entry of entries) {
    if (!entry) continue;
    yield await exportObjectStream(entry);
  }
}
