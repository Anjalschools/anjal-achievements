export type StageWarning = {
  code: string;
  message: string;
};

export type StageError = {
  code: string;
  message: string;
};

export type StageResult = {
  stageId: string;
  success: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  warnings: StageWarning[];
  errors: StageError[];
};

export const createStageResult = (input: {
  stageId: string;
  success: boolean;
  startedAt: Date;
  completedAt?: Date;
  warnings?: StageWarning[];
  errors?: StageError[];
}): StageResult => {
  const completedAt = input.completedAt ?? new Date();
  return {
    stageId: input.stageId,
    success: input.success,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - input.startedAt.getTime(),
    warnings: input.warnings ?? [],
    errors: input.errors ?? [],
  };
};
