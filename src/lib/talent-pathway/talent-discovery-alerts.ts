export type TalentDiscoveryCandidate = {
  studentId: string;
  studentName: string;
  grade?: string;
  alertReasonAr: string;
  alertReasonEn: string;
  achievementScore: number;
  trainingOutcomeScore: number;
  consistencyScore: number;
  recommendationRatePct: number;
  compositeScore: number;
};

export type TalentDiscoveryAlertInput = {
  studentId: string;
  studentName: string;
  grade?: string;
  achievementScore: number;
  trainingOutcomeScore: number;
  consistencyScore: number;
  recommendationRatePct: number;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const identifyHighPotentialStudents = (
  candidates: TalentDiscoveryAlertInput[]
): TalentDiscoveryCandidate[] => {
  return candidates
    .map((candidate) => {
      const compositeScore = clamp(
        candidate.achievementScore * 0.3 +
          candidate.trainingOutcomeScore * 0.3 +
          candidate.consistencyScore * 0.2 +
          candidate.recommendationRatePct * 0.2
      );

      const reasonsAr: string[] = [];
      const reasonsEn: string[] = [];

      if (candidate.achievementScore >= 70 && candidate.trainingOutcomeScore >= 70) {
        reasonsAr.push("إنجاز عالٍ + نتيجة تدريب مرتفعة");
        reasonsEn.push("High achievement + strong training outcome");
      }
      if (candidate.recommendationRatePct >= 80) {
        reasonsAr.push("معدل توصية مرتفع");
        reasonsEn.push("High recommendation rate");
      }
      if (candidate.consistencyScore >= 80) {
        reasonsAr.push("اتساق استثنائي بين التقييمات");
        reasonsEn.push("Exceptional evaluation consistency");
      }

      return {
        ...candidate,
        compositeScore,
        alertReasonAr: reasonsAr.join(" · ") || "إمكانات واعدة",
        alertReasonEn: reasonsEn.join(" · ") || "Promising potential",
      };
    })
    .filter(
      (row) =>
        row.compositeScore >= 72 ||
        (row.achievementScore >= 75 && row.trainingOutcomeScore >= 65) ||
        row.consistencyScore >= 85
    )
    .sort((a, b) => b.compositeScore - a.compositeScore);
};
