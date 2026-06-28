import type { RestoreConfig } from "@/lib/disaster-recovery-v2/restore/restore-config";

export type RestoreContext = {
  config: RestoreConfig;
  startedAt: string;
  extractedRootDir: string;
  artifacts: Record<string, unknown>;
};

export const createRestoreContext = (config: RestoreConfig): RestoreContext => ({
  config,
  startedAt: new Date().toISOString(),
  extractedRootDir: `${config.workspaceDir}/restore`,
  artifacts: {},
});
