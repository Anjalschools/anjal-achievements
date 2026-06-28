import type { BackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";
import type { StageResult } from "@/lib/disaster-recovery-v2/types/stage-result";

export type BackupArtifacts = Record<string, unknown>;

export type BackupContext = {
  config: BackupConfig;
  startedAt: string;
  stageResults: StageResult[];
  artifacts: BackupArtifacts;
};

export const createBackupContext = (config: BackupConfig): BackupContext => ({
  config,
  startedAt: new Date().toISOString(),
  stageResults: [],
  artifacts: {},
});
