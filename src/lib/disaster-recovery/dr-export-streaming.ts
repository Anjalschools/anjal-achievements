import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";
import type { Readable } from "stream";

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
}): Promise<StreamingObjectExportResult> => {
  const manifestEntries: StorageManifestEntry[] = [];
  const failures: StorageManifestEntry[] = [];
  let bytesExported = 0;
  const total = input.entries.length;

  for (let index = 0; index < input.entries.length; index += 1) {
    const source = input.entries[index];
    if (!source) continue;

    try {
      const exported = await input.exportObjectStream(source);
      await input.onObjectReady({
        stream: exported.stream,
        completed: exported.completed,
        archivePath: source.archivePath,
      });
      const finalizedEntry = await exported.completed;
      manifestEntries.push(finalizedEntry);
      bytesExported += finalizedEntry.fileSize || 0;
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

export async function* exportStorageObjectsStreamingSource(
  entries: StorageManifestEntry[],
  exportObjectStream: (entry: StorageManifestEntry) => Promise<ExportedObjectStreamPayload>
): AsyncGenerator<ExportedObjectStreamPayload, void, void> {
  for (const entry of entries) {
    if (!entry) continue;
    yield await exportObjectStream(entry);
  }
}
