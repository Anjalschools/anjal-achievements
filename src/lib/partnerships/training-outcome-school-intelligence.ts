import "server-only";
import connectDB from "@/lib/mongodb";
import TrainingOutcomeRecord from "@/models/TrainingOutcomeRecord";

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(n)));

const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export type TrainingSchoolIntelligenceIndices = {
  careerExposureIndex: number;
  professionalSkillsIndex: number;
  externalExperienceIndex: number;
  trainingSuccessIndex: number;
  recordCount: number;
  evidence: string;
};

/** Read-only school intelligence extension from TrainingOutcomeRecord only. */
export const buildTrainingSchoolIntelligenceIndices = async (): Promise<TrainingSchoolIntelligenceIndices> => {
  await connectDB();
  const rows = await TrainingOutcomeRecord.find({}).lean();

  if (!rows.length) {
    return {
      careerExposureIndex: 0,
      professionalSkillsIndex: 0,
      externalExperienceIndex: 0,
      trainingSuccessIndex: 0,
      recordCount: 0,
      evidence: "No training outcome records",
    };
  }

  const employabilityAvg = avg(rows.map((r) => r.employabilityScore));
  const readinessAvg = avg(rows.map((r) => r.readinessScore));
  const satisfactionAvg = avg(rows.map((r) => r.studentSatisfactionScore));
  const institutionEvalAvg = avg(rows.map((r) => r.institutionEvaluationScore));
  const totalHours = rows.reduce((s, r) => s + (r.trainingHours || 0), 0);
  const uniqueStudents = new Set(rows.map((r) => String(r.studentId))).size;
  const employmentRecRate = rows.filter((r) => r.recommendedForEmployment).length / rows.length;
  const excellentRate = rows.filter((r) => r.outcomeLevel === "excellent" || r.outcomeLevel === "very_good").length / rows.length;

  const careerExposureIndex = clamp(
    employabilityAvg * 0.4 + readinessAvg * 0.3 + employmentRecRate * 30
  );
  const professionalSkillsIndex = clamp(institutionEvalAvg * 0.5 + employabilityAvg * 0.35 + satisfactionAvg * 1.5);
  const externalExperienceIndex = clamp(
    Math.min(totalHours / Math.max(uniqueStudents, 1), 120) * 0.5 + rows.length / Math.max(uniqueStudents, 1) * 15
  );
  const trainingSuccessIndex = clamp(
    excellentRate * 40 + satisfactionAvg * 4 + institutionEvalAvg * 0.25
  );

  return {
    careerExposureIndex,
    professionalSkillsIndex,
    externalExperienceIndex,
    trainingSuccessIndex,
    recordCount: rows.length,
    evidence: `${rows.length} outcomes, ${uniqueStudents} students, ${Math.round(totalHours)}h`,
  };
};
