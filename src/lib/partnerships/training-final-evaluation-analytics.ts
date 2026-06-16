import "server-only";
import connectDB from "@/lib/mongodb";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";

const avg = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;

export type FinalEvaluationAnalytics = {
  trainingSatisfactionAverage: number;
  institutionEvaluationAverage: number;
  trainingHoursTotal: number;
  trainingCompletionQualityIndex: number;
  studentRecommendationRate: number;
  employmentRecommendationRate: number;
  studentEvaluationCount: number;
  institutionEvaluationCount: number;
  approvedCount: number;
};

export const buildFinalEvaluationAnalytics = async (
  academicYearLabel?: string
): Promise<FinalEvaluationAnalytics> => {
  await connectDB();

  const yearFilter = academicYearLabel ? { academicYearLabel } : {};

  const [studentRows, institutionRows] = await Promise.all([
    TrainingFinalStudentEvaluation.find(yearFilter).lean(),
    TrainingFinalInstitutionEvaluation.find(yearFilter).lean(),
  ]);

  const satisfactionScores = studentRows.map((r) => r.overallSatisfactionScore).filter((n) => n > 0);
  const studentRecommend = studentRows.filter((r) => r.recommendToStudents).length;

  const institutionScoreRows = institutionRows.map((r) => {
    const scores = [
      r.attendanceScore,
      r.punctualityScore,
      r.instructionComplianceScore,
      r.workEthicsScore,
      r.responsibilityScore,
      r.professionalismScore,
      r.communicationScore,
      r.teamworkScore,
      r.initiativeScore,
      r.learningSpeedScore,
      r.taskExecutionScore,
      r.workQualityScore,
      r.safetyComplianceScore,
    ];
    return avg(scores);
  });

  const trainingHoursTotal = institutionRows.reduce((sum, r) => sum + (r.trainingHours || 0), 0);
  const passedCount = institutionRows.filter((r) => r.passedTraining).length;
  const employmentRecommend = institutionRows.filter((r) => r.recommendEmployment).length;
  const approvedCount = institutionRows.filter((r) => r.supervisorReviewStatus === "approved").length;

  const institutionEvalAvg = avg(institutionScoreRows);
  const satisfactionAvg = avg(satisfactionScores);
  const qualityIndex = avg([
    satisfactionAvg * 10,
    institutionEvalAvg * 20,
    studentRows.length && institutionRows.length
      ? (approvedCount / Math.max(institutionRows.length, 1)) * 100
      : 0,
  ]);

  return {
    trainingSatisfactionAverage: satisfactionAvg,
    institutionEvaluationAverage: institutionEvalAvg,
    trainingHoursTotal,
    trainingCompletionQualityIndex: Math.round(qualityIndex),
    studentRecommendationRate:
      studentRows.length > 0 ? Math.round((studentRecommend / studentRows.length) * 1000) / 10 : 0,
    employmentRecommendationRate:
      institutionRows.length > 0
        ? Math.round((employmentRecommend / institutionRows.length) * 1000) / 10
        : 0,
    studentEvaluationCount: studentRows.length,
    institutionEvaluationCount: institutionRows.length,
    approvedCount,
  };
};
