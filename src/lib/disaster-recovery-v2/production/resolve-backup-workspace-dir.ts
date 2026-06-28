import { mkdirSync } from "fs";
import { join } from "path";

export const resolveBackupWorkspaceDir = (recordId: string): string => {
  const workspaceDir = join(process.cwd(), "tmp", "dr-v2-workspaces", recordId);
  mkdirSync(workspaceDir, { recursive: true });
  return workspaceDir;
};
