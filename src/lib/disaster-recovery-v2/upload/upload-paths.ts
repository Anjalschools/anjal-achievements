import { join } from "path";

export const resolveUploadReportPath = (workspaceDir: string): string =>
  join(workspaceDir, "metadata", "upload-report.json");
