import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";

/** Statuses where the opportunity is the student's official approved placement. */
export const APPROVED_TRAINING_PLACEMENT_STATUSES: readonly StudentTrainingApplicationStatus[] = [
  "accepted",
  "awaiting_school_approval",
  "completed",
  "awaiting_final_evaluation_review",
  "final_evaluation_approved",
  "final_evaluation_rejected",
] as const;

export const isApprovedTrainingPlacement = (status: string | null | undefined): boolean => {
  if (!status) return false;
  const normalized = String(status).trim();
  if (normalized === "approved" || normalized === "in_training") return true;
  return (APPROVED_TRAINING_PLACEMENT_STATUSES as readonly string[]).includes(normalized);
};

export const APPROVED_PLACEMENT_BADGE = {
  ar: "فرصتي التدريبية المعتمدة",
  en: "My approved training placement",
} as const;

/** Institution 5-level assessment cards. */
export const INSTITUTION_RATING_LABELS = [
  { value: 1, ar: "ضعيف", en: "Very poor" },
  { value: 2, ar: "مقبول", en: "Poor" },
  { value: 3, ar: "جيد", en: "Good" },
  { value: 4, ar: "جيد جداً", en: "Very good" },
  { value: 5, ar: "ممتاز", en: "Excellent" },
] as const;

/** Student experience 5-level cards. */
export const STUDENT_EXPERIENCE_RATING_LABELS = [
  { value: 1, ar: "ضعيفة جداً", en: "Very weak" },
  { value: 2, ar: "ضعيفة", en: "Weak" },
  { value: 3, ar: "متوسطة", en: "Average" },
  { value: 4, ar: "جيدة", en: "Good" },
  { value: 5, ar: "ممتازة", en: "Excellent" },
] as const;

export const SURVEY_RATING_LABELS = INSTITUTION_RATING_LABELS;

export const INSTITUTION_ASSESSMENT_DIMENSIONS = [
  { key: "attendanceScore", ar: "الالتزام بالحضور", en: "Attendance commitment" },
  { key: "workEthicsScore", ar: "الانضباط المهني", en: "Professional discipline" },
  { key: "communicationScore", ar: "التواصل", en: "Communication" },
  { key: "teamworkScore", ar: "العمل الجماعي", en: "Teamwork" },
  { key: "learningSpeedScore", ar: "المهارات التقنية", en: "Technical skills" },
  { key: "professionalismScore", ar: "الأخلاقيات المهنية", en: "Professional ethics" },
  { key: "initiativeScore", ar: "المبادرة", en: "Initiative" },
  { key: "workQualityScore", ar: "حل المشكلات", en: "Problem solving" },
  { key: "safetyComplianceScore", ar: "اتباع أنظمة السلامة", en: "Safety compliance" },
  { key: "taskExecutionScore", ar: "جودة تنفيذ المهام المسندة", en: "Assigned task performance" },
] as const;

export type InstitutionAssessmentScoreKey = (typeof INSTITUTION_ASSESSMENT_DIMENSIONS)[number]["key"];

export const INSTITUTION_OVERALL_RECOMMENDATIONS = [
  { value: "not_recommended", ar: "غير موصى به", en: "Not recommended", passed: false, future: false, employment: false },
  { value: "recommended", ar: "موصى به", en: "Recommended", passed: true, future: true, employment: false },
  { value: "strongly_recommended", ar: "موصى به بشدة", en: "Strongly recommended", passed: true, future: true, employment: true },
] as const;

/** Map UI scores to full API payload (non-breaking — fills derived fields). */
export const expandInstitutionAssessmentPayload = (
  scores: Record<InstitutionAssessmentScoreKey, number>,
  overallRecommendation: string
): Record<string, unknown> => {
  const rec = INSTITUTION_OVERALL_RECOMMENDATIONS.find((r) => r.value === overallRecommendation) ||
    INSTITUTION_OVERALL_RECOMMENDATIONS[1];

  return {
    attendanceScore: scores.attendanceScore,
    punctualityScore: scores.attendanceScore,
    instructionComplianceScore: scores.workEthicsScore,
    workEthicsScore: scores.workEthicsScore,
    responsibilityScore: scores.professionalismScore,
    professionalismScore: scores.professionalismScore,
    communicationScore: scores.communicationScore,
    teamworkScore: scores.teamworkScore,
    initiativeScore: scores.initiativeScore,
    learningSpeedScore: scores.learningSpeedScore,
    taskExecutionScore: scores.taskExecutionScore,
    workQualityScore: scores.workQualityScore,
    safetyComplianceScore: scores.safetyComplianceScore,
    passedTraining: rec.passed,
    recommendFutureTraining: rec.future,
    recommendEmployment: rec.employment,
  };
};

export const collapseInstitutionAssessmentScores = (
  row: Record<string, unknown>
): Record<InstitutionAssessmentScoreKey, number> => ({
  attendanceScore: Number(row.attendanceScore || 3),
  workEthicsScore: Number(row.workEthicsScore || row.instructionComplianceScore || 3),
  communicationScore: Number(row.communicationScore || 3),
  teamworkScore: Number(row.teamworkScore || 3),
  learningSpeedScore: Number(row.learningSpeedScore || 3),
  professionalismScore: Number(row.professionalismScore || 3),
  initiativeScore: Number(row.initiativeScore || 3),
  workQualityScore: Number(row.workQualityScore || 3),
  safetyComplianceScore: Number(row.safetyComplianceScore || 3),
  taskExecutionScore: Number(row.taskExecutionScore || 3),
});

export const inferOverallRecommendation = (row: Record<string, unknown>): string => {
  if (row.recommendEmployment === true) return "strongly_recommended";
  if (row.recommendFutureTraining === true || row.passedTraining === true) return "recommended";
  if (row.passedTraining === false) return "not_recommended";
  return "recommended";
};

export const INSTITUTION_ACHIEVEMENTS_PREFIX = "أبرز الإنجازات:";
export const INSTITUTION_STRENGTHS_PREFIX = "نقاط القوة:";

export const parseInstitutionStrengthsFields = (
  raw: string
): { topAchievements: string; strengths: string } => {
  const text = String(raw || "").trim();
  if (!text) return { topAchievements: "", strengths: "" };
  const achievementsIdx = text.indexOf(INSTITUTION_ACHIEVEMENTS_PREFIX);
  const strengthsIdx = text.indexOf(INSTITUTION_STRENGTHS_PREFIX);
  if (achievementsIdx === -1 && strengthsIdx === -1) {
    return { topAchievements: "", strengths: text };
  }
  const topAchievements =
    achievementsIdx >= 0
      ? text
          .slice(achievementsIdx + INSTITUTION_ACHIEVEMENTS_PREFIX.length, strengthsIdx >= 0 ? strengthsIdx : undefined)
          .trim()
      : "";
  const strengths =
    strengthsIdx >= 0 ? text.slice(strengthsIdx + INSTITUTION_STRENGTHS_PREFIX.length).trim() : "";
  return { topAchievements, strengths };
};

export const combineInstitutionStrengthsFields = (
  topAchievements: string,
  strengths: string
): string => {
  const parts: string[] = [];
  if (topAchievements.trim()) parts.push(`${INSTITUTION_ACHIEVEMENTS_PREFIX}\n${topAchievements.trim()}`);
  if (strengths.trim()) parts.push(`${INSTITUTION_STRENGTHS_PREFIX}\n${strengths.trim()}`);
  return parts.join("\n\n");
};

export const MAX_TRAINING_EVIDENCE_IMAGES = 8;

export const TRAINING_EVIDENCE_IMAGE_LABELS = [
  { value: "workplace", ar: "صورة من بيئة العمل", en: "Workplace photo" },
  { value: "activity", ar: "نشاط تدريبي", en: "Training activity" },
  { value: "workshop", ar: "ورشة عمل", en: "Workshop" },
  { value: "project", ar: "مشروع", en: "Project" },
  { value: "other", ar: "أخرى", en: "Other" },
] as const;

export type TrainingEvidenceImageLabel = (typeof TRAINING_EVIDENCE_IMAGE_LABELS)[number]["value"];

/** Tolerance above opportunity-derived required hours (e.g. 80 required → up to 90). */
export const TRAINING_HOURS_TOLERANCE = 10;

export const computeOpportunityRequiredTrainingHours = (
  start?: Date | string | null,
  end?: Date | string | null
): number => {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  const days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  return days * 6;
};

export const getTrainingHoursMaxAllowed = (requiredHours: number): number =>
  requiredHours > 0 ? requiredHours + TRAINING_HOURS_TOLERANCE : 0;

export const INSTITUTION_ASSESSMENT_CATEGORIES = [
  {
    id: "professional_commitment",
    ar: "الالتزام المهني",
    en: "Professional commitment",
    keys: ["attendanceScore", "workEthicsScore", "professionalismScore"] as const,
  },
  {
    id: "personal_skills",
    ar: "المهارات الشخصية",
    en: "Personal skills",
    keys: ["communicationScore", "teamworkScore", "initiativeScore"] as const,
  },
  {
    id: "practical_performance",
    ar: "الأداء العملي",
    en: "Practical performance",
    keys: ["learningSpeedScore", "workQualityScore", "taskExecutionScore"] as const,
  },
  {
    id: "safety",
    ar: "السلامة",
    en: "Safety",
    keys: ["safetyComplianceScore"] as const,
  },
] as const;

export const computeInstitutionAssessmentAverage = (
  scores: Record<InstitutionAssessmentScoreKey, number>
): number => {
  const values = INSTITUTION_ASSESSMENT_DIMENSIONS.map((d) => scores[d.key]);
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
};

export const computeStudentExperienceAverage = (scores: {
  practicalBenefitScore: number;
  objectivesClarityScore: number;
  supervisionQualityScore: number;
  workEnvironmentScore: number;
  relevanceScore: number;
}): number => {
  const values = [
    scores.practicalBenefitScore,
    scores.objectivesClarityScore,
    scores.supervisionQualityScore,
    scores.workEnvironmentScore,
    scores.relevanceScore,
  ];
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
};

export const TRAINING_EVIDENCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
