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
import { logDr, logDrMemory } from "@/lib/disaster-recovery/dr-backup-logging";
import { exportStorageObjectsStreaming } from "@/lib/disaster-recovery/object-export";
import {
  serializeStorageManifest,
  STORAGE_MANIFEST_VERSION,
  type StorageManifestEntry,
} from "@/lib/disaster-recovery/storage-manifest-types";
import { summarizeStorageManifest } from "@/lib/disaster-recovery/dr-validation";

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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
  console.log("[DR] BEFORE STREAMING ZIP");
  logDrMemory("memory:before-export");

  const output = new PassThrough();
  const storage = resolveBackupStorageProvider(input.storageProvider);
  const fileName = input.fileName;

  const usesR2Stream = input.storageProvider === "r2" && Boolean(storage.storeStream);
  const storePromise = usesR2Stream
    ? storage.storeStream!({
        fileName,
        body: output,
        contentType: "application/zip",
      }).then((stored) => ({ stored, zipBuffer: undefined as Buffer | undefined }))
    : streamToBuffer(output).then((zipBuffer) =>
        storage.store({ fileName, body: zipBuffer, contentType: "application/zip" }).then(
          (stored) => ({ stored, zipBuffer })
        )
      );

  const writer = await createZipArchiveWriter(output);

  for (const entry of input.entries) {
    writer.append(entry.content, { name: entry.fileName });
  }

  const { manifestEntries, failures, bytesExported } = await exportStorageObjectsStreaming({
    entries: input.inventory,
    onObjectReady: async ({ entry, content }) => {
      writer.append(content, { name: entry.archivePath });
    },
    onProgress: (progress) => {
      if (progress.processed % 100 === 0 || progress.remaining === 0) {
        logDr("export-progress", progress);
        logDrMemory("memory:during-export");
      }
    },
  });

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

  writer.append(Buffer.from(serializeManifest(manifestWithChecksums), "utf8"), {
    name: "manifest.json",
  });
  writer.append(
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

  await writer.finalize();

  const { stored, zipBuffer } = await storePromise;

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
