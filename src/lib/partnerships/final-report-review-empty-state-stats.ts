import { analyzeTrainingReportConsistency } from "@/lib/partnerships/training-report-consistency";

export type FinalReportReviewListItem = {
  status: string;
  volunteerHours?: number | null;
  positionTitle?: string;
  practicalBenefitRating?: number | null;
  supervisorCooperationRating?: number | null;
  workEnvironmentRating?: number | null;
  recommendInstitutionToPeers?: boolean | null;
  studentBenefitRating?: number | null;
  assignedTasks?: string;
  studentReflection?: string;
  biggestChallenge?: string;
  challengeResponse?: string;
  wishedToLearn?: string;
  futureImpact?: string;
  institutionNotes?: string;
  institutionUploadedEvaluation?: Record<string, unknown> | null;
  institutionReportExtraction?: Record<string, unknown> | null;
};

export type FinalReportReviewEmptyStateStats = {
  awaitingReview: number;
  needsRevision: number;
  averageConsistencyScore: number | null;
  validationSuccessRate: number | null;
};

const roundPct = (value: number) => Math.round(value);

export const computeFinalReportReviewEmptyStateStats = (
  items: FinalReportReviewListItem[]
): FinalReportReviewEmptyStateStats => {
  const awaitingReview = items.filter((row) =>
    ["submitted", "under_review", "resubmitted"].includes(row.status)
  ).length;
  const needsRevision = items.filter((row) => row.status === "needs_revision").length;

  const consistencyScores: number[] = [];
  let validationTotal = 0;
  let validationSuccess = 0;

  for (const item of items) {
    const consistency = analyzeTrainingReportConsistency({
      volunteerHours: item.volunteerHours,
      positionTitle: item.positionTitle,
      practicalBenefitRating: item.practicalBenefitRating,
      supervisorCooperationRating: item.supervisorCooperationRating,
      workEnvironmentRating: item.workEnvironmentRating,
      recommendInstitutionToPeers: item.recommendInstitutionToPeers,
      studentBenefitRating: item.studentBenefitRating,
      assignedTasks: item.assignedTasks,
      studentReflection: item.studentReflection,
      biggestChallenge: item.biggestChallenge,
      challengeResponse: item.challengeResponse,
      wishedToLearn: item.wishedToLearn,
      futureImpact: item.futureImpact,
      institutionNotes: item.institutionNotes,
      institutionUploadedEvaluation: item.institutionUploadedEvaluation,
      institutionReportExtraction: item.institutionReportExtraction,
    });
    if (item.institutionReportExtraction || item.institutionUploadedEvaluation) {
      consistencyScores.push(consistency.consistencyScore);
    }

    const validationResult =
      item.institutionReportExtraction?.validationResult &&
      typeof item.institutionReportExtraction.validationResult === "object"
        ? (item.institutionReportExtraction.validationResult as Record<string, unknown>)
        : null;
    if (validationResult) {
      validationTotal += 1;
      if (String(validationResult.reviewStatus || "").toUpperCase() === "APPROVED") {
        validationSuccess += 1;
      }
    }
  }

  const averageConsistencyScore =
    consistencyScores.length > 0
      ? roundPct(consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length)
      : null;

  const validationSuccessRate =
    validationTotal > 0 ? roundPct((validationSuccess / validationTotal) * 100) : null;

  return {
    awaitingReview,
    needsRevision,
    averageConsistencyScore,
    validationSuccessRate,
  };
};
