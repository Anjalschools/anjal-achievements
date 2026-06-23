import type { ITrainingCompletionRecord } from "@/models/TrainingCompletionRecord";
import {
  INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  recommendationToLegacyRating,
  type InstitutionFinalReportExtractionResult,
  type InstitutionReportSource,
} from "@/lib/partnerships/institution-final-report-constants";
import { validateInstitutionFinalReport } from "@/lib/partnerships/institution-final-report-validation";
import { buildInstitutionReportVisualEvidence } from "@/lib/partnerships/institution-final-report-visual-evidence";

type MutableRecord = Pick<
  ITrainingCompletionRecord,
  | "supervisorName"
  | "supervisorPhone"
  | "positionTitle"
  | "assignedTasks"
  | "attendanceCommitment"
  | "professionalEthics"
  | "safetyCompliance"
  | "overallRecommendation"
  | "institutionNotes"
  | "institutionUploadedEvaluation"
  | "institutionReportSource"
  | "institutionReportFileKey"
  | "institutionReportExtraction"
>;

const hasText = (value?: string | null) => Boolean(String(value || "").trim());
const hasRating = (value?: number | null) => typeof value === "number" && value >= 1 && value <= 5;

const setIfEmptyText = (current: string | undefined, next?: string) =>
  hasText(current) ? current : String(next || "").trim() || undefined;

const setIfEmptyRating = (current: number | undefined, next?: number) =>
  hasRating(current) ? current : next;

const buildExtractionMeta = (
  extraction: InstitutionFinalReportExtractionResult,
  reportFileKey?: string
) => {
  const validationResult =
    extraction.validationResult ?? validateInstitutionFinalReport(extraction, extraction.ocrTextPreview);

  const visualEvidence = buildInstitutionReportVisualEvidence({
    validationResult,
    reportFileKey,
  });

  return {
    confidenceScore: extraction.overallConfidence ?? extraction.confidenceScore,
    hasSignature: extraction.hasSignature,
    hasStamp: extraction.hasStamp,
    extractedAt: new Date(),
    extractionMethod: extraction.extractionMethod,
    ocrTextPreview: extraction.ocrTextPreview,
    ocrConfidence: extraction.ocrConfidence,
    visionConfidence: extraction.visionConfidence,
    overallConfidence: extraction.overallConfidence ?? extraction.confidenceScore,
    fieldsExtracted: { ...extraction },
    validationResult,
    visualEvidence,
    reviewStatus: validationResult.reviewStatus,
    riskFlags: validationResult.riskFlags,
  };
};

export type ApplyInstitutionExtractionResult = {
  populatedFields: string[];
  skippedFields: string[];
  applied: boolean;
};

export const applyInstitutionExtractionToRecord = (
  record: MutableRecord,
  extraction: InstitutionFinalReportExtractionResult,
  source: InstitutionReportSource,
  reportFileKey?: string
): ApplyInstitutionExtractionResult => {
  const populatedFields: string[] = [];
  const skippedFields: string[] = [];

  if (extraction.confidenceScore < INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE) {
    record.institutionReportExtraction = buildExtractionMeta(
      extraction,
      reportFileKey || record.institutionReportFileKey
    );
    return { populatedFields, skippedFields, applied: false };
  }

  const uploaded = { ...(record.institutionUploadedEvaluation || {}) };

  const applyText = (
    recordKey: keyof MutableRecord | "uploaded",
    uploadedKey: keyof typeof uploaded,
    value?: string
  ) => {
    if (!hasText(value)) return;
    if (recordKey === "uploaded") {
      if (hasText(uploaded[uploadedKey] as string | undefined)) {
        skippedFields.push(String(uploadedKey));
        return;
      }
      (uploaded as Record<string, string>)[uploadedKey as string] = String(value).trim();
      populatedFields.push(String(uploadedKey));
      return;
    }
    const current = record[recordKey as keyof MutableRecord] as string | undefined;
    if (hasText(current)) {
      skippedFields.push(String(recordKey));
      return;
    }
    (record as Record<string, unknown>)[recordKey as string] = String(value).trim();
    populatedFields.push(String(recordKey));
  };

  const applyRating = (
    recordKey: keyof MutableRecord | "uploaded",
    uploadedKey: keyof typeof uploaded,
    value?: number
  ) => {
    if (!hasRating(value)) return;
    if (recordKey === "uploaded") {
      if (hasRating(uploaded[uploadedKey] as number | undefined)) {
        skippedFields.push(String(uploadedKey));
        return;
      }
      (uploaded as Record<string, number>)[uploadedKey as string] = value!;
      populatedFields.push(String(uploadedKey));
      return;
    }
    const current = record[recordKey as keyof MutableRecord] as number | undefined;
    if (hasRating(current)) {
      skippedFields.push(String(recordKey));
      return;
    }
    (record as Record<string, unknown>)[recordKey as string] = value;
    populatedFields.push(String(recordKey));
  };

  applyText("supervisorName", "supervisorName", extraction.supervisorName);
  applyText("supervisorPhone", "contactNumber", extraction.contactNumber);
  applyText("positionTitle", "positionTitle", extraction.positionTitle);
  applyText("assignedTasks", "assignedTasks", extraction.assignedTasks);

  applyRating("attendanceCommitment", "attendanceRating", extraction.attendanceRating);
  applyRating("professionalEthics", "ethicsRating", extraction.ethicsRating);
  applyRating("safetyCompliance", "safetyRating", extraction.safetyRating);

  const legacyRecommendation = recommendationToLegacyRating(extraction.recommendation);
  if (legacyRecommendation != null) {
    const current = record.overallRecommendation;
    if (hasRating(current)) skippedFields.push("overallRecommendation");
    else {
      record.overallRecommendation = legacyRecommendation;
      populatedFields.push("overallRecommendation");
    }
  }

  applyRating("uploaded", "disciplineRating", extraction.disciplineRating);
  applyRating("uploaded", "communicationRating", extraction.communicationRating);
  applyRating("uploaded", "teamworkRating", extraction.teamworkRating);
  applyRating("uploaded", "initiativeRating", extraction.initiativeRating);
  applyRating("uploaded", "technicalSkillsRating", extraction.technicalSkillsRating);
  applyRating("uploaded", "problemSolvingRating", extraction.problemSolvingRating);
  applyRating("uploaded", "taskExecutionRating", extraction.taskExecutionRating);

  applyText("uploaded", "achievements", extraction.achievements);
  applyText("uploaded", "strengths", extraction.strengths);
  applyText("uploaded", "improvementAreas", extraction.improvementAreas);
  if (extraction.recommendation && !uploaded.recommendation) {
    uploaded.recommendation = extraction.recommendation;
    populatedFields.push("recommendation");
  } else if (extraction.recommendation && uploaded.recommendation) {
    skippedFields.push("recommendation");
  }

  if (Object.keys(uploaded).length > 0) {
    record.institutionUploadedEvaluation = uploaded;
  }

  const narrativeParts = [
    extraction.achievements ? `أبرز الإنجازات: ${extraction.achievements}` : "",
    extraction.strengths ? `نقاط القوة: ${extraction.strengths}` : "",
    extraction.improvementAreas ? `فرص التحسين: ${extraction.improvementAreas}` : "",
  ].filter(Boolean);

  if (narrativeParts.length > 0 && !hasText(record.institutionNotes)) {
    record.institutionNotes = narrativeParts.join("\n\n").slice(0, 4000);
    populatedFields.push("institutionNotes");
  } else if (narrativeParts.length > 0) {
    skippedFields.push("institutionNotes");
  }

  if (!record.institutionReportSource || record.institutionReportSource !== "portal") {
    record.institutionReportSource = source;
  }

  record.institutionReportExtraction = {
    ...buildExtractionMeta(extraction, reportFileKey || record.institutionReportFileKey),
    populatedFields,
    skippedFields,
  };

  return { populatedFields, skippedFields, applied: populatedFields.length > 0 };
};

export const mergeSupervisorDefaults = (input: {
  existingName?: string;
  existingPhone?: string;
  organizationContactName?: string;
  organizationContactPhone?: string;
  completionSupervisorName?: string;
  completionSupervisorPhone?: string;
}) => ({
  supervisorName:
    setIfEmptyText(input.existingName, input.completionSupervisorName || input.organizationContactName) ||
    "",
  supervisorPhone:
    setIfEmptyText(input.existingPhone, input.completionSupervisorPhone || input.organizationContactPhone) ||
    "",
});
