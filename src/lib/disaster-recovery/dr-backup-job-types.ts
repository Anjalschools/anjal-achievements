import type { BackupModuleId, BackupStorageProviderId } from "@/lib/backup/backup-constants";
import type { RetentionTier } from "@/lib/disaster-recovery/retention-policy";

export type StartDisasterRecoveryJobInput = {
  moduleId: BackupModuleId;
  storageProvider: BackupStorageProviderId;
  createdByUserId: string;
  includeObjects?: boolean;
  retentionTier?: RetentionTier;
  note?: string;
};

export type DisasterRecoveryJobAccepted = {
  recordId: string;
  status: "pending";
  statusUrl: string;
  fileName: string;
};
