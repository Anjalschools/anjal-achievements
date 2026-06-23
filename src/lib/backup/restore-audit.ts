import type { RestoreMode } from "@/lib/backup/backup-constants";
import type { BackupManifest } from "@/lib/backup/backup-manifest";

export const buildRestoreAuditMetadata = (input: {
  backupIdentifier: string;
  mode: RestoreMode;
  collections: string[];
  recordCounts: Record<string, number>;
  preRestoreBackupId?: string;
  manifest?: BackupManifest;
}) => ({
  backupIdentifier: input.backupIdentifier,
  mode: input.mode,
  collectionsRestored: input.collections,
  recordCounts: input.recordCounts,
  preRestoreBackupId: input.preRestoreBackupId,
  manifestVersion: input.manifest?.version,
  manifestCreatedAt: input.manifest?.createdAt,
});
