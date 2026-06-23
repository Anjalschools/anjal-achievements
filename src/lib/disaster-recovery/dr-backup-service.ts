import "server-only";
import connectDB from "@/lib/mongodb";
import AcademicYear from "@/models/AcademicYear";
import BackupRecord from "@/models/BackupRecord";
import { getBackupModule, type BackupModuleId } from "@/lib/backup/backup-constants";
import { buildBackupManifest } from "@/lib/backup/backup-manifest";
import { buildBackupZipPackage, countCollectionDocuments } from "@/lib/backup/backup-package";
import {
  cacheLocalBackupZip,
  type CreateBackupInput,
  type CreateBackupResult,
} from "@/lib/backup/backup-service";
import { resolveBackupStorageProvider } from "@/lib/backup/backup-storage";
import { buildZipFromEntries, type BackupPackageExtraFile } from "@/lib/backup/backup-zip";
import { scanStorageInventory } from "@/lib/disaster-recovery/storage-inventory";
import { exportStorageObjects } from "@/lib/disaster-recovery/object-export";
import {
  serializeStorageManifest,
  STORAGE_MANIFEST_VERSION,
} from "@/lib/disaster-recovery/storage-manifest-types";
import { summarizeStorageManifest } from "@/lib/disaster-recovery/dr-validation";
import type { RetentionTier } from "@/lib/disaster-recovery/retention-policy";

export type CreateDisasterRecoveryBackupInput = CreateBackupInput & {
  includeObjects?: boolean;
  retentionTier?: RetentionTier;
};

const buildDrFileName = (moduleId: BackupModuleId): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `anjal-dr-backup-${moduleId}-${stamp}.zip`;
};

export const createDisasterRecoveryBackup = async (
  input: CreateDisasterRecoveryBackupInput
): Promise<CreateBackupResult & { objectCount?: number; recoveryReadinessScore?: number }> => {
  await connectDB();
  const includeObjects = input.includeObjects !== false;
  const mod = getBackupModule(input.moduleId);
  const recordCounts: Record<string, number> = {};

  for (const collectionKey of mod.collectionKeys) {
    recordCounts[collectionKey] = await countCollectionDocuments(collectionKey);
  }

  const current = await AcademicYear.findOne({ isCurrent: true }).select("label name").lean();
  const academicYear = current ? String(current.label || current.name || "") : null;

  const manifest = buildBackupManifest({
    backupModule: input.moduleId,
    collections: mod.collectionKeys,
    recordCounts,
    academicYear,
    includesObjectStorage: includeObjects,
  });

  const { entries } = await buildBackupZipPackage({
    manifest,
    collectionKeys: mod.collectionKeys,
  });

  const extraFiles: BackupPackageExtraFile[] = [];
  let objectCount = 0;
  let objectSizeBytes = 0;
  let recoveryReadinessScore = includeObjects ? 0 : 50;

  if (includeObjects) {
    const inventory = await scanStorageInventory();
    const { exported, failures } = await exportStorageObjects(inventory, { maxConcurrency: 3 });
    const mergedEntries = [...exported.map((row) => row.entry), ...failures];
    const summary = summarizeStorageManifest(mergedEntries);

    extraFiles.push({
      path: "storage-manifest.json",
      content: Buffer.from(
        serializeStorageManifest({
          version: STORAGE_MANIFEST_VERSION,
          createdAt: new Date().toISOString(),
          ...summary,
          entries: mergedEntries,
        }),
        "utf8"
      ),
    });

    for (const row of exported) {
      extraFiles.push({ path: row.entry.archivePath, content: row.content });
    }

    objectCount = summary.objectCount;
    objectSizeBytes = summary.totalBytes;
    manifest.objectCount = objectCount;
    manifest.objectSizeBytes = objectSizeBytes;
    recoveryReadinessScore = Math.round((summary.exportedCount / Math.max(1, objectCount)) * 100);
  }

  const zipBuffer = await buildZipFromEntries({
    manifest,
    entries,
    extraFiles,
  });

  const fileName = buildDrFileName(input.moduleId);
  const storage = resolveBackupStorageProvider(input.storageProvider);
  const stored = await storage.store({
    fileName,
    body: zipBuffer,
    contentType: "application/zip",
  });

  const record = await BackupRecord.create({
    createdBy: input.createdByUserId,
    backupType: input.moduleId,
    backupModule: input.moduleId,
    backupKind: includeObjects ? "disaster_recovery" : "database",
    status: "completed",
    sizeBytes: stored.sizeBytes,
    manifestVersion: manifest.version,
    storageProvider: stored.provider,
    storageKey: stored.storageKey,
    fileName,
    recordCounts,
    academicYearLabel: academicYear || undefined,
    note: input.note,
    objectCount,
    objectSizeBytes,
    recoveryReadinessScore,
    retentionTier: input.retentionTier || "daily",
    validationStatus: "pending",
    includesObjectStorage: includeObjects,
  });

  const recordId = String(record._id);
  if (stored.provider === "local") {
    cacheLocalBackupZip(recordId, zipBuffer);
  }

  return {
    recordId,
    fileName,
    sizeBytes: stored.sizeBytes,
    manifestVersion: manifest.version,
    recordCounts,
    storageProvider: stored.provider,
    storageKey: stored.storageKey,
    downloadReady: true,
    zipBuffer: stored.provider === "local" ? zipBuffer : undefined,
    objectCount,
    recoveryReadinessScore,
  };
};
