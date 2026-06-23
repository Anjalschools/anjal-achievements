const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export type PartnerReliabilityInput = {
  reportCompletionRatePct?: number;
  averageResponseDays?: number;
  approvalCompletionRatePct?: number;
  studentRecommendationRatePct?: number;
  supervisorApprovalRatePct?: number;
};

export type PartnerReliabilityResult = {
  partnerReliabilityIndex: number;
  reportCompletionRatePct: number;
  responseSpeedScore: number;
  approvalCompletionRatePct: number;
  studentRecommendationRatePct: number;
  supervisorApprovalRatePct: number;
};

export const computePartnerReliabilityIndex = (
  input: PartnerReliabilityInput
): PartnerReliabilityResult => {
  const reportCompletionRatePct = clamp(input.reportCompletionRatePct ?? 0);
  const approvalCompletionRatePct = clamp(input.approvalCompletionRatePct ?? 0);
  const studentRecommendationRatePct = clamp(input.studentRecommendationRatePct ?? 0);
  const supervisorApprovalRatePct = clamp(input.supervisorApprovalRatePct ?? 0);

  const avgDays = Math.max(0, input.averageResponseDays ?? 0);
  const responseSpeedScore =
    avgDays <= 1 ? 100 : avgDays <= 3 ? 85 : avgDays <= 7 ? 65 : avgDays <= 14 ? 45 : 25;

  const partnerReliabilityIndex = clamp(
    reportCompletionRatePct * 0.25 +
      responseSpeedScore * 0.2 +
      approvalCompletionRatePct * 0.2 +
      studentRecommendationRatePct * 0.2 +
      supervisorApprovalRatePct * 0.15
  );

  return {
    partnerReliabilityIndex,
    reportCompletionRatePct,
    responseSpeedScore,
    approvalCompletionRatePct,
    studentRecommendationRatePct,
    supervisorApprovalRatePct,
  };
};
