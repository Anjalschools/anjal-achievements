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
import { buildZipFromEntries, type BackupPackageEntry } from "@/lib/backup/backup-zip";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { isR2Configured } from "@/lib/r2";
import { scanStorageInventory } from "@/lib/disaster-recovery/storage-inventory";
import type { RetentionTier } from "@/lib/disaster-recovery/retention-policy";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";
import {
  DisasterRecoveryBackupError,
  logDr,
  logDrDebug,
  runDrStage,
} from "@/lib/disaster-recovery/dr-backup-logging";
import { truncateDrErrorStack } from "@/lib/disaster-recovery/dr-diag-policy";
import { buildAndStoreStreamingDisasterRecoveryZip } from "@/lib/disaster-recovery/dr-streaming-backup";
import { updateDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { resolveDisasterRecoveryStorageProvider } from "@/lib/disaster-recovery/dr-storage-resolution";
import {
  logDrMilestone,
  logDrException,
  updateDrVerificationReport,
} from "@/lib/disaster-recovery/dr-verification";

export type CreateDisasterRecoveryBackupInput = CreateBackupInput & {
  includeObjects?: boolean;
  retentionTier?: RetentionTier;
  existingRecordId?: string;
};

type ManifestStageResult = {
  manifest: BackupManifest;
  entries: BackupPackageEntry[];
  recordCounts: Record<string, number>;
  academicYear: string | null;
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

const isLegacyDrBackupRuntimeEnabled = (): boolean =>
  process.env.LEGACY_DR_BACKUP_ENABLED === "1";

/** @deprecated Rollback-only. Production uses executeProductionV2Backup (DR.BACKUP.V2). */
export const createDisasterRecoveryBackup = async (
  input: CreateDisasterRecoveryBackupInput
): Promise<CreateBackupResult & { objectCount?: number; recoveryReadinessScore?: number }> => {
  if (!isLegacyDrBackupRuntimeEnabled()) {
    throw new Error(
      "LEGACY_DR_BACKUP_DISABLED: use executeProductionV2Backup via the DR worker queue"
    );
  }

  console.log("[DR] SERVICE ENTER");
  logDr("START", {
    moduleId: input.moduleId,
    storageProvider: input.storageProvider,
    includeObjects: input.includeObjects !== false,
    retentionTier: input.retentionTier || "daily",
  });

  const includeObjects = input.includeObjects !== false;
  const fileName = buildDrFileName(input.moduleId);

  const storageResolution = resolveDisasterRecoveryStorageProvider({
    requested: input.storageProvider,
    includeObjects,
    source: "dr-backup-service",
  });
  const effectiveStorageProvider = storageResolution.resolved;

  try {
    console.log("[DR] BEFORE MANIFEST");
    updateDrJobContext({ phase: "manifest" });
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
    console.log("[DR] AFTER MANIFEST");

    let objectCount = 0;
    let objectSizeBytes = 0;
    let recoveryReadinessScore = includeObjects ? 0 : 50;
    let zipBuffer: Buffer | undefined;
    let storedArtifact: Awaited<
      ReturnType<typeof buildAndStoreStreamingDisasterRecoveryZip>
    >["stored"] | null = null;

    if (includeObjects) {
      updateDrJobContext({ phase: "inventory" });
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

      updateDrJobContext({ phase: "object-export", totalObjects: inventory.length });
      const streamingResult = await runDrStage(
        "object-export",
        async () => {
          manifestStage.manifest.objectCount = inventory.length;

          return buildAndStoreStreamingDisasterRecoveryZip({
            manifest: manifestStage.manifest,
            entries: manifestStage.entries,
            inventory,
            fileName,
            storageProvider: effectiveStorageProvider,
          });
        },
        (result) => ({
          objectCount: result.objectCount,
          exportedCount: result.exportedCount,
          failedCount: result.failedCount,
          objectSizeBytes: result.objectSizeBytes,
          zipBytes: result.stored.sizeBytes,
          storageProvider: result.stored.provider,
        })
      );

      updateDrJobContext({ phase: "zip" });
      await runDrStage("zip", async () => streamingResult, (result) => ({
        zipBytes: result.stored.sizeBytes,
        streamed: true,
      }));

      objectCount = streamingResult.objectCount;
      objectSizeBytes = streamingResult.objectSizeBytes;
      recoveryReadinessScore = streamingResult.recoveryReadinessScore;
      manifestStage.manifest.objectCount = objectCount;
      manifestStage.manifest.objectSizeBytes = objectSizeBytes;
      zipBuffer = streamingResult.zipBuffer;
      storedArtifact = streamingResult.stored;
    } else {
      logDr("inventory:skipped", { reason: "includeObjects=false" });
      logDr("object-export:skipped", { reason: "includeObjects=false" });

      zipBuffer = await runDrStage(
        "zip",
        async () =>
          buildZipFromEntries({
            manifest: manifestStage.manifest,
            entries: manifestStage.entries,
          }),
        (buffer) => ({
          zipBytes: buffer.byteLength,
          collectionFiles: manifestStage.entries.length,
        })
      );
    }

    const result = await runDrStage(
      "backup-record",
      async () => {
        updateDrJobContext({ phase: "backup-record" });
        console.log("[DR] BEFORE backup-record persist");
        const stored =
          storedArtifact ||
          (await resolveBackupStorageProvider(effectiveStorageProvider).store({
            fileName,
            body: zipBuffer as Buffer,
            contentType: "application/zip",
          }));

        const recordPayload = {
          status: "completed" as const,
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
          validationStatus: "pending" as const,
          includesObjectStorage: includeObjects,
          jobPhase: "complete",
          processedObjects: objectCount,
          jobCompletedAt: new Date(),
        };

        let recordId: string;
        if (input.existingRecordId) {
          await BackupRecord.findByIdAndUpdate(input.existingRecordId, recordPayload);
          recordId = input.existingRecordId;
          logDrMilestone("BACKUP_RECORD_SAVED", { recordId, updated: true });
        } else {
          const record = await BackupRecord.create({
            createdBy: input.createdByUserId,
            backupType: input.moduleId,
            backupModule: input.moduleId,
            backupKind: includeObjects ? "disaster_recovery" : "database",
            ...recordPayload,
          });
          recordId = String(record._id);
          logDrMilestone("BACKUP_RECORD_CREATED", { recordId });
          logDrMilestone("BACKUP_RECORD_SAVED", { recordId, updated: false });
        }
        logDrMilestone("BACKUP_STATUS_COMPLETED", { recordId, status: "completed" });
        updateDrVerificationReport({ backupSaved: true });
        console.log("[DR] AFTER backup-record persist", { recordId });

        if (stored.provider === "local" && zipBuffer) {
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
    const stage = error instanceof DisasterRecoveryBackupError ? error.stage : "unknown";
    logDr("FAILED", { stage, message, stack: truncateDrErrorStack(error) });
    logDrException(stage, error);
    throw error;
  }
};
