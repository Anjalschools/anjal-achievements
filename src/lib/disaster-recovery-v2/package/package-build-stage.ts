import type { BackupStage } from "@/lib/disaster-recovery-v2/types/stage";

export const PACKAGE_BUILD_STAGE_ID = "package-build" as const;

export type PackageBuildStage = BackupStage & {
  readonly id: typeof PACKAGE_BUILD_STAGE_ID;
};
