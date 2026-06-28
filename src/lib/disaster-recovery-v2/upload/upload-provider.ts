import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import type { UploadArtifact, UploadResult } from "@/lib/disaster-recovery-v2/upload/upload-artifact-types";

export interface BackupUploadProvider {
  readonly id: string;
  upload(file: UploadArtifact, context: BackupContext): Promise<UploadResult>;
}
