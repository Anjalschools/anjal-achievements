import "server-only";
import connectDB from "@/lib/mongodb";
import { resolveFinalEvaluationContext } from "@/lib/partnerships/training-final-evaluation-access";
import { buildFinalReportTemplateContext } from "@/lib/partnerships/training-final-report-context-builder";
import { generateTrainingFinalReportPdfBuffer } from "@/lib/partnerships/training-final-report-pdf-generator";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";
import type { FinalEvaluationAttachmentRef } from "@/lib/partnerships/training-final-evaluation-constants";

export const buildApplicationFinalReportPdfBuffer = async (
  applicationId: string
): Promise<Buffer | null> => {
  await connectDB();
  const ctx = await resolveFinalEvaluationContext(applicationId);
  if (!ctx) return null;

  const [studentEvaluation, institutionEvaluation] = await Promise.all([
    TrainingFinalStudentEvaluation.findOne({ applicationId }).lean(),
    TrainingFinalInstitutionEvaluation.findOne({ applicationId }).lean(),
  ]);

  const templateContext = buildFinalReportTemplateContext({
    studentName: ctx.application.studentSnapshot?.fullName || "",
    school: ctx.application.studentSnapshot?.school || "—",
    institutionName: ctx.organization?.name || "",
    opportunityTitle: ctx.opportunity?.title || "",
    trainingStartDate: ctx.opportunity?.trainingStart,
    trainingEndDate: ctx.opportunity?.trainingEnd,
    studentEvaluation: studentEvaluation as Record<string, unknown> | null,
    institutionEvaluation: institutionEvaluation as Record<string, unknown> | null,
  });

  return generateTrainingFinalReportPdfBuffer(templateContext);
};

/** Draft preview — student section only, institution section blank, no persistence. */
export const buildDraftStudentFinalReportPdfBuffer = async (input: {
  applicationId: string;
  draft: Record<string, unknown>;
}): Promise<Buffer | null> => {
  await connectDB();
  const ctx = await resolveFinalEvaluationContext(input.applicationId);
  if (!ctx) return null;

  const images = Array.isArray(input.draft.imageAttachments)
    ? (input.draft.imageAttachments as FinalEvaluationAttachmentRef[])
    : [];
  const videoUrls = Array.isArray(input.draft.videoUrls)
    ? input.draft.videoUrls.map((u) => String(u || "").trim()).filter(Boolean)
    : [];

  const draftStudent = {
    ...input.draft,
    imageEvidence: images.map((img) => ({
      fileName: img.fileName,
      label: img.label,
      caption: img.caption,
    })),
    videoUrl: videoUrls[0] || "",
  };

  const templateContext = buildFinalReportTemplateContext({
    studentName: ctx.application.studentSnapshot?.fullName || "",
    school: ctx.application.studentSnapshot?.school || "—",
    institutionName: ctx.organization?.name || "",
    opportunityTitle: ctx.opportunity?.title || "",
    trainingStartDate: ctx.opportunity?.trainingStart,
    trainingEndDate: ctx.opportunity?.trainingEnd,
    trainingHours:
      input.draft.trainingHours != null && input.draft.trainingHours !== ""
        ? String(input.draft.trainingHours)
        : undefined,
    studentEvaluation: draftStudent,
    institutionEvaluation: null,
  });

  return generateTrainingFinalReportPdfBuffer(templateContext);
};
