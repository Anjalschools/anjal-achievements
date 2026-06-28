import type { StageError, StageResult, StageWarning } from "@/lib/disaster-recovery-v2/types/stage-result";

export type BackupResult = {
  success: boolean;
  jobId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stageResults: StageResult[];
  warnings: StageWarning[];
  errors: StageError[];
};

export const buildBackupResult = (input: {
  jobId: string;
  startedAt: string;
  completedAt: string;
  stageResults: StageResult[];
}): BackupResult => {
  const startedMs = Date.parse(input.startedAt);
  const completedMs = Date.parse(input.completedAt);
  const warnings = input.stageResults.flatMap((stage) => stage.warnings);
  const errors = input.stageResults.flatMap((stage) => stage.errors);
  const success = input.stageResults.every((stage) => stage.success);

  return {
    success,
    jobId: input.jobId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: Number.isFinite(startedMs) && Number.isFinite(completedMs)
      ? completedMs - startedMs
      : 0,
    stageResults: input.stageResults,
    warnings,
    errors,
  };
};
