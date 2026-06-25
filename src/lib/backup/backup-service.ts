import "server-only";
import connectDB from "@/lib/mongodb";
import AcademicYear from "@/models/AcademicYear";
import BackupRecord from "@/models/BackupRecord";
import {
  type BackupModuleId,
  type BackupStorageProviderId,
  getBackupModule,
} from "@/lib/backup/backup-constants";
import { buildBackupManifest } from "@/lib/backup/backup-manifest";
import { buildBackupZipPackage, countCollectionDocuments } from "@/lib/backup/backup-package";
import { resolveBackupStorageProvider } from "@/lib/backup/backup-storage";
import { normalizeWorkerPhaseForRead } from "@/lib/disaster-recovery/worker/dr-worker-state";

export type CreateBackupInput = {
  moduleId: BackupModuleId;
  storageProvider: BackupStorageProviderId;
  createdByUserId: string;
  note?: string;
};

export type CreateBackupResult = {
  recordId: string;
  fileName: string;
  sizeBytes: number;
  manifestVersion: string;
  recordCounts: Record<string, number>;
  storageProvider: BackupStorageProviderId;
  storageKey?: string;
  downloadReady: boolean;
  zipBuffer?: Buffer;
};

const resolveCurrentAcademicYearLabel = async (): Promise<string | null> => {
  await connectDB();
  const current = await AcademicYear.findOne({ isCurrent: true }).select("label name").lean();
  if (!current) return null;
  return String(current.label || current.name || "");
};

const buildBackupFileName = (moduleId: BackupModuleId): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `anjal-backup-${moduleId}-${stamp}.zip`;
};

const LOCAL_BACKUP_CACHE_TTL_MS = 60 * 60 * 1000;
const localBackupCache = new Map<string, { buffer: Buffer; expiresAt: number }>();

export const cacheLocalBackupZip = (recordId: string, buffer: Buffer): void => {
  localBackupCache.set(recordId, {
    buffer,
    expiresAt: Date.now() + LOCAL_BACKUP_CACHE_TTL_MS,
  });
};

export const readCachedLocalBackupZip = (recordId: string): Buffer | null => {
  const row = localBackupCache.get(recordId);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    localBackupCache.delete(recordId);
    return null;
  }
  return row.buffer;
};

export const createBackup = async (input: CreateBackupInput): Promise<CreateBackupResult> => {
  await connectDB();
  const mod = getBackupModule(input.moduleId);
  const recordCounts: Record<string, number> = {};

  for (const collectionKey of mod.collectionKeys) {
    recordCounts[collectionKey] = await countCollectionDocuments(collectionKey);
  }

  const academicYear = await resolveCurrentAcademicYearLabel();
  const manifest = buildBackupManifest({
    backupModule: input.moduleId,
    collections: mod.collectionKeys,
    recordCounts,
    academicYear,
  });

  const { zipBuffer } = await buildBackupZipPackage({
    manifest,
    collectionKeys: mod.collectionKeys,
  });

  const fileName = buildBackupFileName(input.moduleId);
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
    status: "completed",
    sizeBytes: stored.sizeBytes,
    manifestVersion: manifest.version,
    storageProvider: stored.provider,
    storageKey: stored.storageKey,
    fileName,
    recordCounts,
    academicYearLabel: academicYear ?? undefined,
    note: input.note,
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
  };
};

export const listBackupRecords = async (limit = 50) => {
  await connectDB();
  const rows = await BackupRecord.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("createdBy", "name email")
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    backupType: row.backupType,
    backupModule: row.backupModule,
    status: row.status,
    sizeBytes: row.sizeBytes ?? 0,
    manifestVersion: row.manifestVersion,
    storageProvider: row.storageProvider,
    storageKey: row.storageKey,
    fileName: row.fileName,
    recordCounts: row.recordCounts ?? {},
    academicYearLabel: row.academicYearLabel,
    note: row.note,
    errorMessage: row.errorMessage,
    jobPhase: row.jobPhase,
    processedObjects: row.processedObjects,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    createdBy: row.createdBy
      ? {
          id: String((row.createdBy as { _id?: { toString(): string } })._id || ""),
          name: (row.createdBy as { name?: string }).name,
          email: (row.createdBy as { email?: string }).email,
        }
      : null,
  }));
};

export const getBackupRecordById = async (id: string) => {
  await connectDB();
  const row = await BackupRecord.findById(id).populate("createdBy", "name email").lean();
  if (!row) return null;
  return {
    id: String(row._id),
    backupType: row.backupType,
    backupModule: row.backupModule,
    status: row.status,
    sizeBytes: row.sizeBytes ?? 0,
    manifestVersion: row.manifestVersion,
    storageProvider: row.storageProvider,
    storageKey: row.storageKey,
    fileName: row.fileName,
    recordCounts: row.recordCounts ?? {},
    academicYearLabel: row.academicYearLabel,
    note: row.note,
    errorMessage: row.errorMessage,
    includesObjectStorage: row.includesObjectStorage,
    objectCount: row.objectCount,
    recoveryReadinessScore: row.recoveryReadinessScore,
    jobPhase: normalizeWorkerPhaseForRead(row.jobPhase),
    processedObjects: row.processedObjects,
    totalObjects: row.totalObjects,
    bytesExported: row.bytesExported,
    heartbeatAt: row.heartbeatAt ? new Date(row.heartbeatAt).toISOString() : null,
    workerId: row.workerId,
    jobElapsedMs: row.jobElapsedMs,
    jobMemoryRss: row.jobMemoryRss,
    jobHeapUsed: row.jobHeapUsed,
    leaseExpiresAt: row.leaseExpiresAt ? new Date(row.leaseExpiresAt).toISOString() : null,
    cancelRequested: row.cancelRequested === true,
    archivePointer: row.archivePointer,
    jobStartedAt: row.jobStartedAt ? new Date(row.jobStartedAt).toISOString() : null,
    jobCompletedAt: row.jobCompletedAt ? new Date(row.jobCompletedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    createdBy: row.createdBy
      ? {
          id: String((row.createdBy as { _id?: { toString(): string } })._id || ""),
          name: (row.createdBy as { name?: string }).name,
          email: (row.createdBy as { email?: string }).email,
        }
      : null,
  };
};

export const loadBackupZipByRecordId = async (id: string): Promise<Buffer> => {
  await connectDB();
  const row = await BackupRecord.findById(id).lean();
  if (!row) throw new Error("BACKUP_NOT_FOUND");
  if (row.storageProvider === "r2" && row.storageKey) {
    const storage = resolveBackupStorageProvider("r2");
    return storage.retrieve(row.storageKey);
  }
  throw new Error("BACKUP_FILE_NOT_AVAILABLE");
};

export const deleteBackupRecordMetadata = async (id: string): Promise<boolean> => {
  await connectDB();
  const result = await BackupRecord.findByIdAndDelete(id);
  return Boolean(result);
};
