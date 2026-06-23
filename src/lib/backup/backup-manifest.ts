import { createHash } from "crypto";
import {
  BACKUP_MANIFEST_VERSION,
  BACKUP_PLATFORM_VERSION,
  type BackupModuleId,
} from "@/lib/backup/backup-constants";

export type BackupManifest = {
  version: string;
  createdAt: string;
  platformVersion: string;
  academicYear: string | null;
  backupModule: BackupModuleId;
  collections: string[];
  recordCounts: Record<string, number>;
  checksums?: Record<string, string>;
  includesObjectStorage?: boolean;
  objectCount?: number;
  objectSizeBytes?: number;
};

export const buildBackupManifest = (input: {
  backupModule: BackupModuleId;
  collections: string[];
  recordCounts: Record<string, number>;
  academicYear?: string | null;
  checksums?: Record<string, string>;
  includesObjectStorage?: boolean;
  objectCount?: number;
  objectSizeBytes?: number;
}): BackupManifest => ({
  version: BACKUP_MANIFEST_VERSION,
  createdAt: new Date().toISOString(),
  platformVersion: BACKUP_PLATFORM_VERSION,
  academicYear: input.academicYear ?? null,
  backupModule: input.backupModule,
  collections: input.collections,
  recordCounts: input.recordCounts,
  checksums: input.checksums,
  includesObjectStorage: input.includesObjectStorage,
  objectCount: input.objectCount,
  objectSizeBytes: input.objectSizeBytes,
});

export const serializeManifest = (manifest: BackupManifest): string =>
  `${JSON.stringify(manifest, null, 2)}\n`;

export const parseManifest = (raw: string): BackupManifest => {
  const parsed = JSON.parse(raw) as BackupManifest;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("MANIFEST_INVALID");
  }
  return parsed;
};

export const hashContent = (content: Buffer | string): string =>
  createHash("sha256").update(content).digest("hex");
