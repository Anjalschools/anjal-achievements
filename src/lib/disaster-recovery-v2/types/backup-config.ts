export type BackupConfig = {
  jobId: string;
  workspaceDir: string;
  initiatedBy?: string;
  scope?: "full" | "partial";
};

export const createBackupConfig = (input: {
  jobId: string;
  workspaceDir: string;
  initiatedBy?: string;
  scope?: "full" | "partial";
}): BackupConfig => ({
  jobId: input.jobId,
  workspaceDir: input.workspaceDir,
  initiatedBy: input.initiatedBy,
  scope: input.scope ?? "full",
});
