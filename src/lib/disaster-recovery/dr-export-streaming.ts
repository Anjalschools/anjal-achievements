import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

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
