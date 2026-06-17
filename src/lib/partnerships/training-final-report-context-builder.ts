import type { TrainingFinalReportTemplateContext } from "@/lib/partnerships/training-final-report-template-constants";
import { parseInstitutionStrengthsFields } from "@/lib/partnerships/training-final-evaluation-ui-constants";

const formatDate = (value?: Date | string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-SA");
  } catch {
    return "—";
  }
};

const blankScores = () => ({
  attendance: 0,
  punctuality: 0,
  instructionCompliance: 0,
  workEthics: 0,
  responsibility: 0,
  professionalism: 0,
  communication: 0,
  teamwork: 0,
  initiative: 0,
  learningSpeed: 0,
  taskExecution: 0,
  workQuality: 0,
  safetyCompliance: 0,
});

const hasInstitutionScores = (row: Record<string, unknown> | null | undefined): boolean => {
  if (!row) return false;
  return Number(row.attendanceScore || 0) > 0 || Boolean(row.supervisorName);
};

export const buildFinalReportTemplateContext = (input: {
  studentName: string;
  school: string;
  institutionName: string;
  opportunityTitle: string;
  trainingStartDate?: Date | string | null;
  trainingEndDate?: Date | string | null;
  trainingHours?: number | string | null;
  studentEvaluation?: Record<string, unknown> | null;
  institutionEvaluation?: Record<string, unknown> | null;
  draft?: Record<string, unknown>;
}): TrainingFinalReportTemplateContext => {
  const student = input.studentEvaluation || {};
  const institution = input.institutionEvaluation || {};
  const draft = input.draft || {};
  const institutionComplete = hasInstitutionScores(institution) || hasInstitutionScores(draft);

  const inst = institutionComplete ? { ...draft, ...institution } : {};
  const parsedStrengths = institutionComplete
    ? parseInstitutionStrengthsFields(String(inst.strengths || ""))
    : { topAchievements: "", strengths: "" };

  const scores = institutionComplete
    ? {
        attendance: Number(inst.attendanceScore || 0),
        punctuality: Number(inst.punctualityScore || inst.attendanceScore || 0),
        instructionCompliance: Number(inst.instructionComplianceScore || inst.workEthicsScore || 0),
        workEthics: Number(inst.workEthicsScore || 0),
        responsibility: Number(inst.responsibilityScore || inst.professionalismScore || 0),
        professionalism: Number(inst.professionalismScore || 0),
        communication: Number(inst.communicationScore || 0),
        teamwork: Number(inst.teamworkScore || 0),
        initiative: Number(inst.initiativeScore || 0),
        learningSpeed: Number(inst.learningSpeedScore || 0),
        taskExecution: Number(inst.taskExecutionScore || 0),
        workQuality: Number(inst.workQualityScore || 0),
        safetyCompliance: Number(inst.safetyComplianceScore || 0),
      }
    : blankScores();

  return {
    studentName: input.studentName,
    school: input.school,
    institutionName: input.institutionName,
    opportunityTitle: input.opportunityTitle,
    trainingStartDate: formatDate(
      (student.trainingStartDate as string) || input.trainingStartDate
    ),
    trainingEndDate: formatDate((student.trainingEndDate as string) || input.trainingEndDate),
    trainingHours: String(
      student.trainingHours || inst.trainingHours || input.trainingHours || "—"
    ),
    assignedTasks: String(
      student.majorTasksCompleted || inst.assignedTasks || draft.assignedTasks || ""
    ),
    studentSection: {
      practicalBenefitScore: Number(student.practicalBenefitScore || 0),
      objectivesClarityScore: Number(student.objectivesClarityScore || 0),
      supervisionQualityScore: Number(student.supervisionQualityScore || 0),
      workEnvironmentScore: Number(student.workEnvironmentScore || 0),
      relevanceScore: Number(student.relevanceScore || 0),
      overallSatisfactionScore: Number(student.overallSatisfactionScore || 0),
      skillsLearned: String(student.skillsLearned || ""),
      majorTasksCompleted: String(student.majorTasksCompleted || ""),
      improvementSuggestions: String(student.improvementSuggestions || ""),
      mostValuableExperience: String(student.mostValuableExperience || ""),
      recommendToStudents: student.recommendToStudents === true,
      videoUrl: String(
        student.videoUrl ||
          (Array.isArray(student.videoUrls) ? student.videoUrls[0] : "") ||
          ""
      ),
      imageEvidence: Array.isArray(student.imageEvidence)
        ? (student.imageEvidence as Array<{ label?: string; caption?: string; fileName: string }>)
        : Array.isArray(student.imageAttachments)
          ? (student.imageAttachments as Array<Record<string, unknown>>).map((img) => ({
              fileName: String(img.fileName || ""),
              label: img.label ? String(img.label) : undefined,
              caption: img.caption ? String(img.caption) : undefined,
            }))
          : [],
    },
    scores,
    institutionSectionComplete: institutionComplete,
    passedTraining: institutionComplete ? inst.passedTraining === true : false,
    recommendFutureTraining: institutionComplete ? inst.recommendFutureTraining === true : false,
    recommendEmployment: institutionComplete ? inst.recommendEmployment === true : false,
    topAchievements: institutionComplete ? parsedStrengths.topAchievements : "",
    strengths: institutionComplete ? parsedStrengths.strengths : "",
    improvementAreas: institutionComplete ? String(inst.improvementAreas || "") : "",
    finalRecommendation: institutionComplete ? String(inst.finalRecommendation || "") : "",
    supervisorName: institutionComplete ? String(inst.supervisorName || "") : "",
    supervisorTitle: institutionComplete ? String(inst.supervisorTitle || "") : "",
    supervisorPhone: institutionComplete ? String(inst.supervisorPhone || "") : "",
    generatedAt: new Date().toLocaleDateString("ar-SA"),
  };
};
