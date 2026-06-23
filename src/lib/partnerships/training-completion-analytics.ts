type TrainingCompletionAnalyticsRow = {
  studentBenefitRating?: number | null;
  supervisorCooperationRating?: number | null;
  practicalBenefitRating?: number | null;
  workEnvironmentRating?: number | null;
  recommendInstitutionToPeers?: boolean | null;
  volunteerHours?: number | null;
  attendanceCommitment?: number | null;
  professionalEthics?: number | null;
  overallRecommendation?: number | null;
};

const averagePositive = (values: number[]) => {
  const filtered = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!filtered.length) return 0;
  return Math.round((filtered.reduce((sum, v) => sum + v, 0) / filtered.length) * 10) / 10;
};

export const buildTrainingCompletionStudentEvaluationAverages = (
  rows: TrainingCompletionAnalyticsRow[]
) => {
  const benefit = averagePositive(rows.map((r) => Number(r.studentBenefitRating || 0)));
  const supervisorCooperation = averagePositive(
    rows.map((r) => Number(r.supervisorCooperationRating || 0))
  );
  const practicalBenefit = averagePositive(rows.map((r) => Number(r.practicalBenefitRating || 0)));
  const workEnvironment = averagePositive(rows.map((r) => Number(r.workEnvironmentRating || 0)));
  const recommendYes = rows.filter((r) => r.recommendInstitutionToPeers === true).length;
  const recommendTotal = rows.filter((r) => typeof r.recommendInstitutionToPeers === "boolean").length;
  const recommendPct =
    recommendTotal > 0 ? Math.round((recommendYes / recommendTotal) * 100) : 0;

  return {
    avgStudentBenefitRating: benefit,
    avgSupervisorCooperationRating: supervisorCooperation,
    avgPracticalBenefitRating: practicalBenefit,
    avgWorkEnvironmentRating: workEnvironment,
    recommendInstitutionToPeersPct: recommendPct,
    totalTrainingHours: rows.reduce((sum, r) => sum + Number(r.volunteerHours || 0), 0),
  };
};

export const buildTrainingCompletionSupervisorRatingAverage = (
  row: TrainingCompletionAnalyticsRow
) => {
  const studentOrgRatings = [
    row.supervisorCooperationRating,
    row.practicalBenefitRating,
    row.workEnvironmentRating,
  ].filter((v): v is number => typeof v === "number" && v > 0);

  if (studentOrgRatings.length > 0) {
    return studentOrgRatings.reduce((a, b) => a + b, 0) / studentOrgRatings.length;
  }

  const legacy = [row.attendanceCommitment, row.professionalEthics, row.overallRecommendation].filter(
    (v): v is number => typeof v === "number" && v > 0
  );
  return legacy.length ? legacy.reduce((a, b) => a + b, 0) / legacy.length : 0;
};
