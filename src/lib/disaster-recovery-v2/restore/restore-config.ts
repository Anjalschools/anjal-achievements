export type RestoreMode = "replace" | "merge";

export type RestoreConfig = {
  jobId: string;
  workspaceDir: string;
  backupZipPath?: string;
  restoreMode?: RestoreMode;
  initiatedBy?: string;
};

export const createRestoreConfig = (input: {
  jobId: string;
  workspaceDir: string;
  backupZipPath?: string;
  restoreMode?: RestoreMode;
  initiatedBy?: string;
}): RestoreConfig => ({
  jobId: input.jobId,
  workspaceDir: input.workspaceDir,
  backupZipPath: input.backupZipPath,
  restoreMode: input.restoreMode ?? "replace",
  initiatedBy: input.initiatedBy,
});
