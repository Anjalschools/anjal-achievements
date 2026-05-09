export type StudentPromotionJobResult = {
  ok: true;
  dryRun: boolean;
  examined: number;
  promoted: number;
  skipped: number;
};

export type StudentPromotionJobError = {
  ok: false;
  code: string;
};

export type RunStudentPromotionResult = StudentPromotionJobResult | StudentPromotionJobError;
