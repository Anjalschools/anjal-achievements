import "server-only";
import connectDB from "@/lib/mongodb";
import AcademicYear from "@/models/AcademicYear";
import BackupRecord from "@/models/BackupRecord";
import { getBackupModule, type BackupModuleId } from "@/lib/backup/backup-constants";
import { buildBackupManifest, type BackupManifest } from "@/lib/backup/backup-manifest";
import { buildBackupZipPackage, countCollectionDocuments } from "@/lib/backup/backup-package";
import {
  cacheLocalBackupZip,
  type CreateBackupInput,
  type CreateBackupResult,
} from "@/lib/backup/backup-service";
import { resolveBackupStorageProvider } from "@/lib/backup/backup-storage";
import {
  buildZipFromEntries,
  type BackupPackageEntry,
  type BackupPackageExtraFile,
} from "@/lib/backup/backup-zip";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { isR2Configured } from "@/lib/r2";
import { scanStorageInventory } from "@/lib/disaster-recovery/storage-inventory";
import { exportStorageObjects } from "@/lib/disaster-recovery/object-export";
import {
  serializeStorageManifest,
  STORAGE_MANIFEST_VERSION,
} from "@/lib/disaster-recovery/storage-manifest-types";
import { summarizeStorageManifest } from "@/lib/disaster-recovery/dr-validation";
import type { RetentionTier } from "@/lib/disaster-recovery/retention-policy";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";
import {
  DisasterRecoveryBackupError,
  logDr,
  logDrDebug,
  runDrStage,
} from "@/lib/disaster-recovery/dr-backup-logging";

export type CreateDisasterRecoveryBackupInput = CreateBackupInput & {
  includeObjects?: boolean;
  retentionTier?: RetentionTier;
};

type ManifestStageResult = {
  manifest: BackupManifest;
  entries: BackupPackageEntry[];
  recordCounts: Record<string, number>;
  academicYear: string | null;
};

type ObjectExportStageResult = {
  extraFiles: BackupPackageExtraFile[];
  objectCount: number;
  objectSizeBytes: number;
  recoveryReadinessScore: number;
  exportedCount: number;
  failedCount: number;
};

const buildDrFileName = (moduleId: BackupModuleId): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `anjal-dr-backup-${moduleId}-${stamp}.zip`;
};

const countInventoryByProvider = (
  inventory: StorageManifestEntry[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const entry of inventory) {
    counts[entry.provider] = (counts[entry.provider] || 0) + 1;
  }
  return counts;
};

const verifyExportProviderConfiguration = (inventory: StorageManifestEntry[]): void => {
  const providerCounts = countInventoryByProvider(inventory);
  const r2Objects = providerCounts.r2 || 0;
  const cloudinaryObjects = providerCounts.cloudinary || 0;
  const r2Configured = isR2Configured();
  const cloudinaryConfigured = isCloudinaryConfigured();

  logDrDebug("inventory:provider-config", {
    providerCounts,
    r2Configured,
    cloudinaryConfigured,
  });

  if (r2Objects > 0 && !r2Configured) {
    throw new DisasterRecoveryBackupError("inventory", "R2_NOT_CONFIGURED", {
      details: { r2Objects, providerCounts },
    });
  }

  if (cloudinaryObjects > 0 && !cloudinaryConfigured) {
    throw new DisasterRecoveryBackupError("inventory", "CLOUDINARY_NOT_CONFIGURED", {
      details: { cloudinaryObjects, providerCounts },
    });
  }
};

export const createDisasterRecoveryBackup = async (
  input: CreateDisasterRecoveryBackupInput
): Promise<CreateBackupResult & { objectCount?: number; recoveryReadinessScore?: number }> => {
  logDr("START", {
    moduleId: input.moduleId,
    storageProvider: input.storageProvider,
    includeObjects: input.includeObjects !== false,
    retentionTier: input.retentionTier || "daily",
  });

  const includeObjects = input.includeObjects !== false;

  try {
    const manifestStage = await runDrStage(
      "manifest",
      async (): Promise<ManifestStageResult> => {
        await connectDB();
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

        return { manifest, entries, recordCounts, academicYear };
      },
      (result) => ({
        collectionCount: result.manifest.collections.length,
        recordCounts: result.recordCounts,
        entryCount: result.entries.length,
        manifestVersion: result.manifest.version,
      })
    );

    let extraFiles: BackupPackageExtraFile[] = [];
    let objectCount = 0;
    let objectSizeBytes = 0;
    let recoveryReadinessScore = includeObjects ? 0 : 50;

    if (includeObjects) {
      const inventory = await runDrStage(
        "inventory",
        async () => {
          const entries = await scanStorageInventory();
          verifyExportProviderConfiguration(entries);
          return entries;
        },
        (entries) => ({
          objectCount: entries.length,
          providerCounts: countInventoryByProvider(entries),
          r2Configured: isR2Configured(),
          cloudinaryConfigured: isCloudinaryConfigured(),
        })
      );

      const objectExportStage = await runDrStage(
        "object-export",
        async (): Promise<ObjectExportStageResult> => {
          const { exported, failures } = await exportStorageObjects(inventory, {
            maxConcurrency: 3,
          });
          const mergedEntries = [...exported.map((row) => row.entry), ...failures];
          const summary = summarizeStorageManifest(mergedEntries);

          const manifestBuffer = Buffer.from(
            serializeStorageManifest({
              version: STORAGE_MANIFEST_VERSION,
              createdAt: new Date().toISOString(),
              ...summary,
              entries: mergedEntries,
            }),
            "utf8"
          );

          const stageExtraFiles: BackupPackageExtraFile[] = [
            {
              path: "storage-manifest.json",
              content: manifestBuffer,
            },
          ];

          for (const row of exported) {
            stageExtraFiles.push({ path: row.entry.archivePath, content: row.content });
          }

          const score = Math.round((summary.exportedCount / Math.max(1, summary.objectCount)) * 100);

          return {
            extraFiles: stageExtraFiles,
            objectCount: summary.objectCount,
            objectSizeBytes: summary.totalBytes,
            recoveryReadinessScore: score,
            exportedCount: summary.exportedCount,
            failedCount: summary.failedCount,
          };
        },
        (result) => ({
          objectCount: result.objectCount,
          exportedCount: result.exportedCount,
          failedCount: result.failedCount,
          objectSizeBytes: result.objectSizeBytes,
          extraFileCount: result.extraFiles.length,
          storageManifestBytes:
            result.extraFiles.find((file) => file.path === "storage-manifest.json")?.content.byteLength || 0,
        })
      );

      extraFiles = objectExportStage.extraFiles;
      objectCount = objectExportStage.objectCount;
      objectSizeBytes = objectExportStage.objectSizeBytes;
      recoveryReadinessScore = objectExportStage.recoveryReadinessScore;
      manifestStage.manifest.objectCount = objectCount;
      manifestStage.manifest.objectSizeBytes = objectSizeBytes;
    } else {
      logDr("inventory:skipped", { reason: "includeObjects=false" });
      logDr("object-export:skipped", { reason: "includeObjects=false" });
    }

    const zipBuffer = await runDrStage(
      "zip",
      async () =>
        buildZipFromEntries({
          manifest: manifestStage.manifest,
          entries: manifestStage.entries,
          extraFiles,
        }),
      (buffer) => ({
        zipBytes: buffer.byteLength,
        collectionFiles: manifestStage.entries.length,
        extraFiles: extraFiles.length,
      })
    );

    const result = await runDrStage(
      "backup-record",
      async () => {
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
          manifestVersion: manifestStage.manifest.version,
          storageProvider: stored.provider,
          storageKey: stored.storageKey,
          fileName,
          recordCounts: manifestStage.recordCounts,
          academicYearLabel: manifestStage.academicYear ?? undefined,
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
          manifestVersion: manifestStage.manifest.version,
          recordCounts: manifestStage.recordCounts,
          storageProvider: stored.provider,
          storageKey: stored.storageKey,
          downloadReady: true as const,
          zipBuffer: stored.provider === "local" ? zipBuffer : undefined,
          objectCount,
          recoveryReadinessScore,
        };
      },
      (value) => ({
        recordId: value.recordId,
        fileName: value.fileName,
        sizeBytes: value.sizeBytes,
        storageProvider: value.storageProvider,
        objectCount: value.objectCount,
        recoveryReadinessScore: value.recoveryReadinessScore,
      })
    );

    logDr("COMPLETE", {
      recordId: result.recordId,
      objectCount: result.objectCount,
      recoveryReadinessScore: result.recoveryReadinessScore,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const stage = error instanceof DisasterRecoveryBackupError ? error.stage : "unknown";
    logDr("FAILED", { stage, message, stack });
    throw error;
  }
};
