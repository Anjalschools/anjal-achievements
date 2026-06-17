import "server-only";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
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
  institutionRecommendationRate: number;
  safetyComplianceAverage: number;
  technicalSkillsAverage: number;
  studentEvaluationCount: number;
  institutionEvaluationCount: number;
  approvedCount: number;
  topTrainingInstitutions: Array<{
    institutionId: string;
    institutionName: string;
    averageScore: number;
    evaluationCount: number;
  }>;
  mostRecommendedStudents: Array<{
    studentId: string;
    averageScore: number;
    recommendEmployment: boolean;
  }>;
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

  const safetyScores = institutionRows.map((r) => r.safetyComplianceScore).filter((n) => n > 0);
  const technicalScores = institutionRows.map((r) => r.learningSpeedScore).filter((n) => n > 0);

  const trainingHoursTotal = institutionRows.reduce((sum, r) => sum + (r.trainingHours || 0), 0);
  const employmentRecommend = institutionRows.filter((r) => r.recommendEmployment).length;
  const futureRecommend = institutionRows.filter((r) => r.recommendFutureTraining).length;
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

  const institutionAgg = new Map<string, { total: number; count: number }>();
  institutionRows.forEach((row, index) => {
    const id = String(row.institutionId);
    const score = institutionScoreRows[index] || 0;
    const prev = institutionAgg.get(id) || { total: 0, count: 0 };
    institutionAgg.set(id, { total: prev.total + score, count: prev.count + 1 });
  });

  const orgIds = [...institutionAgg.keys()];
  const orgs = await PartnerOrganization.find({ _id: { $in: orgIds } }).select("name").lean();
  const orgMap = new Map(orgs.map((o) => [String(o._id), o.name || ""]));

  const topTrainingInstitutions = [...institutionAgg.entries()]
    .map(([institutionId, agg]) => ({
      institutionId,
      institutionName: orgMap.get(institutionId) || institutionId,
      averageScore: Math.round((agg.total / Math.max(agg.count, 1)) * 10) / 10,
      evaluationCount: agg.count,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 5);

  const mostRecommendedStudents = institutionRows
    .filter((r) => r.recommendEmployment === true || r.recommendFutureTraining === true)
    .map((r) => {
      const scores = [
        r.attendanceScore,
        r.communicationScore,
        r.learningSpeedScore,
        r.taskExecutionScore,
        r.safetyComplianceScore,
      ];
      return {
        studentId: String(r.studentId),
        averageScore: avg(scores),
        recommendEmployment: r.recommendEmployment === true,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 5);

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
    institutionRecommendationRate:
      institutionRows.length > 0
        ? Math.round((futureRecommend / institutionRows.length) * 1000) / 10
        : 0,
    safetyComplianceAverage: avg(safetyScores),
    technicalSkillsAverage: avg(technicalScores),
    studentEvaluationCount: studentRows.length,
    institutionEvaluationCount: institutionRows.length,
    approvedCount,
    topTrainingInstitutions,
    mostRecommendedStudents,
  };
};
