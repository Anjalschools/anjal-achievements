import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import {
  BACKUP_RESTORE_BATCH_SIZE,
  type RestoreMode,
  resolveMongoCollectionName,
} from "@/lib/backup/backup-constants";
import {
  extractBackupZipPackage,
  parseCollectionBackupContent,
} from "@/lib/backup/backup-package";
import { createBackup } from "@/lib/backup/backup-service";
import {
  buildDryRunRestoreReport,
  validateExtractedBackupPackage,
  type DryRunRestoreReport,
} from "@/lib/backup/restore-validation";
import type { BackupStorageProviderId } from "@/lib/backup/backup-constants";
import { buildRestoreAuditMetadata } from "@/lib/backup/restore-audit";
import { validateDisasterRecoveryPackage } from "@/lib/disaster-recovery/dr-validation";
import { parseStorageManifest } from "@/lib/disaster-recovery/storage-manifest-types";
import {
  restoreObjectStorageBatch,
  type ObjectRestoreProgress,
} from "@/lib/disaster-recovery/restore-object-storage";

export { buildRestoreAuditMetadata } from "@/lib/backup/restore-audit";

export type RestoreProgress = {
  collectionKey: string;
  processed: number;
  total: number;
  action: "skipped" | "inserted" | "updated" | "deleted";
};

export type RestoreExecutionResult = {
  mode: RestoreMode;
  collections: string[];
  recordCounts: Record<string, number>;
  progress: RestoreProgress[];
  objectRestoreProgress?: ObjectRestoreProgress[];
  preRestoreBackupId?: string;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const normalizeId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "$oid" in value) {
    return String((value as { $oid: string }).$oid);
  }
  if (typeof value === "object" && value !== null && "_id" in value) {
    return normalizeId((value as { _id: unknown })._id);
  }
  return String(value);
};

const restoreCollectionReplace = async (
  collectionKey: string,
  documents: Record<string, unknown>[]
): Promise<RestoreProgress> => {
  await connectDB();
  const collectionName = resolveMongoCollectionName(collectionKey);
  const collection = mongoose.connection.collection(collectionName);
  await collection.deleteMany({});
  if (!documents.length) {
    return { collectionKey, processed: 0, total: 0, action: "deleted" };
  }

  let processed = 0;
  for (const batch of chunkArray(documents, BACKUP_RESTORE_BATCH_SIZE)) {
    await collection.insertMany(batch, { ordered: false });
    processed += batch.length;
  }

  return { collectionKey, processed, total: documents.length, action: "inserted" };
};

const restoreCollectionMerge = async (
  collectionKey: string,
  documents: Record<string, unknown>[]
): Promise<RestoreProgress> => {
  await connectDB();
  const collectionName = resolveMongoCollectionName(collectionKey);
  const collection = mongoose.connection.collection(collectionName);

  let inserted = 0;
  let updated = 0;

  for (const batch of chunkArray(documents, BACKUP_RESTORE_BATCH_SIZE)) {
    for (const doc of batch) {
      const id = normalizeId(doc._id);
      if (!id) continue;
      const result = await collection.replaceOne({ _id: new mongoose.Types.ObjectId(id) }, doc, {
        upsert: true,
      });
      if (result.upsertedCount > 0) inserted += 1;
      else if (result.modifiedCount > 0) updated += 1;
    }
  }

  return {
    collectionKey,
    processed: inserted + updated,
    total: documents.length,
    action: updated > 0 ? "updated" : "inserted",
  };
};

export const inspectBackupPackage = async (zipBuffer: Buffer) => {
  const extracted = await extractBackupZipPackage(zipBuffer);
  const validation = validateExtractedBackupPackage(extracted);
  const drValidation = extracted.manifest.includesObjectStorage
    ? validateDisasterRecoveryPackage(extracted)
    : undefined;
  const dryRun = buildDryRunRestoreReport(validation);
  return { extracted, validation, drValidation, dryRun };
};

export const dryRunRestoreBackup = async (zipBuffer: Buffer): Promise<DryRunRestoreReport> => {
  const { dryRun } = await inspectBackupPackage(zipBuffer);
  return dryRun;
};

export const executeRestoreBackup = async (input: {
  zipBuffer: Buffer;
  mode: RestoreMode;
  selectiveCollectionKeys?: string[];
  actorUserId: string;
  createPreRestoreSnapshot?: boolean;
  snapshotStorageProvider?: BackupStorageProviderId;
  restoreObjects?: boolean;
}): Promise<RestoreExecutionResult> => {
  const extracted = await extractBackupZipPackage(input.zipBuffer);
  const validation = validateExtractedBackupPackage(extracted);
  if (validation.status !== "PASS" || !validation.manifest) {
    throw new Error(`RESTORE_VALIDATION_FAILED:${validation.reasons.join("|")}`);
  }

  if (extracted.manifest.includesObjectStorage) {
    const drValidation = validateDisasterRecoveryPackage(extracted);
    if (drValidation.status !== "PASS") {
      throw new Error(`DR_RESTORE_VALIDATION_FAILED:${drValidation.database.reasons.concat(drValidation.objects.reasons).join("|")}`);
    }
  }

  let targetKeys = validation.manifest.collections;
  if (input.mode === "selective") {
    if (!input.selectiveCollectionKeys?.length) {
      throw new Error("SELECTIVE_COLLECTIONS_REQUIRED");
    }
    targetKeys = input.selectiveCollectionKeys.filter((key) =>
      validation.manifest!.collections.includes(key)
    );
  }

  let preRestoreBackupId: string | undefined;
  if (input.mode === "replace" && input.createPreRestoreSnapshot !== false) {
    const snapshot = await createBackup({
      moduleId: "full",
      storageProvider: input.snapshotStorageProvider || "local",
      createdByUserId: input.actorUserId,
      note: "pre-restore-snapshot",
    });
    preRestoreBackupId = snapshot.recordId;
  }

  const progress: RestoreProgress[] = [];
  const recordCounts: Record<string, number> = {};

  for (const collectionKey of targetKeys) {
    const mongoName = resolveMongoCollectionName(collectionKey);
    const content = extracted.collections[mongoName];
    const documents = content ? parseCollectionBackupContent(content) : [];
    recordCounts[collectionKey] = documents.length;

    if (input.mode === "merge" || input.mode === "selective") {
      progress.push(await restoreCollectionMerge(collectionKey, documents));
    } else {
      progress.push(await restoreCollectionReplace(collectionKey, documents));
    }
  }

  let objectRestoreProgress: ObjectRestoreProgress[] | undefined;
  if (
    input.restoreObjects !== false &&
    extracted.manifest.includesObjectStorage &&
    extracted.storageManifest
  ) {
    const storageManifest = parseStorageManifest(extracted.storageManifest.toString("utf8"));
    const restorable = storageManifest.entries.filter(
      (entry) =>
        entry.status === "exported" &&
        (entry.provider === "r2" || entry.provider === "cloudinary")
    );
    objectRestoreProgress = await restoreObjectStorageBatch({
      objects: extracted.objects,
      entries: restorable,
      batchSize: BACKUP_RESTORE_BATCH_SIZE,
    });
  }

  return {
    mode: input.mode,
    collections: targetKeys,
    recordCounts,
    progress,
    objectRestoreProgress,
    preRestoreBackupId,
  };
};
