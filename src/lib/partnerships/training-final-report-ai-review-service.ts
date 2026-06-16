import "server-only";
import { extractPdfTextForAchievementReview, fetchPdfBufferForAchievementReview } from "@/lib/achievement-admin-pdf-review";
import { collapseWhitespace, compareStudentNameToRecord } from "@/lib/achievement-attachment-normalization";
import { computeDocumentFingerprint } from "@/lib/document-content-fingerprint";
import type {
  FinalEvaluationAiClassification,
  FinalEvaluationAiVerification,
} from "@/lib/partnerships/training-final-evaluation-constants";
import { FINAL_EVALUATION_TIMELINE_ACTIONS } from "@/lib/partnerships/training-final-evaluation-constants";

const POSITIVE_SIGNALS = [
  "توقيع",
  "ختم",
  "المشرف",
  "التدريب",
  "الطالب",
  "المؤسسة",
  "ساعات",
  "signature",
  "stamp",
  "supervisor",
  "training",
  "student",
  "institution",
] as const;

const resolveClassification = (score: number): FinalEvaluationAiClassification => {
  if (score >= 85) return "verified";
  if (score >= 60) return "review_required";
  return "suspicious";
};

export type TrainingFinalReportAiReviewInput = {
  reportFileKey: string;
  studentName: string;
  institutionName: string;
  trainingHours?: number;
  trainingStartDate?: string;
  trainingEndDate?: string;
  supervisorName: string;
};

export const runTrainingFinalReportAiReview = async (
  input: TrainingFinalReportAiReviewInput
): Promise<FinalEvaluationAiVerification> => {
  const verifiedAt = new Date().toISOString();
  let rawText = "";
  let fingerprint = computeDocumentFingerprint({ storageKey: input.reportFileKey });

  try {
    const fetched = await fetchPdfBufferForAchievementReview(input.reportFileKey);
    if ("buffer" in fetched) {
      fingerprint = computeDocumentFingerprint({ buffer: fetched.buffer });
      rawText = (await extractPdfTextForAchievementReview(fetched.buffer)).text || "";
    }
  } catch {
    rawText = "";
  }

  const text = collapseWhitespace(rawText).toLowerCase();
  const positiveSignals = POSITIVE_SIGNALS.filter((sig) => text.includes(sig.toLowerCase()));
  const negativeSignals: string[] = [];
  if (!text.trim()) negativeSignals.push("empty_ocr");

  const fieldChecks = {
    studentName:
      compareStudentNameToRecord({ detected: text, systemNames: [input.studentName] }).strength !== "none",
    institutionName: text.includes(input.institutionName.trim().toLowerCase().slice(0, 8)),
    trainingHours: input.trainingHours ? text.includes(String(input.trainingHours)) : text.includes("ساع"),
    trainingDates:
      Boolean(input.trainingStartDate && text.includes(input.trainingStartDate.slice(0, 4))) ||
      text.includes("تاريخ"),
    supervisorName:
      compareStudentNameToRecord({ detected: text, systemNames: [input.supervisorName] }).strength !== "none",
    supervisorSignature: text.includes("توقيع") || text.includes("signature"),
    institutionStamp: text.includes("ختم") || text.includes("stamp"),
  };

  const passedChecks = Object.values(fieldChecks).filter(Boolean).length;
  let score = Math.round((passedChecks / 7) * 70 + positiveSignals.length * 3);
  if (negativeSignals.includes("empty_ocr") && !input.reportFileKey) score = Math.min(score, 40);
  score = Math.max(0, Math.min(100, score));

  const classification = resolveClassification(score);

  return {
    verificationScore: score,
    classification,
    positiveSignals: [...positiveSignals],
    negativeSignals,
    summaryAr:
      classification === "verified"
        ? "التقرير يتضمن معظم عناصر التحقق المطلوبة."
        : classification === "review_required"
          ? "يُنصح بمراجعة بشرية للتقرير قبل الاعتماد."
          : "التقرير يحتاج تحققاً إضافياً — قد تكون بيانات ناقصة أو غير متطابقة.",
    summaryEn:
      classification === "verified"
        ? "Report includes most required verification elements."
        : classification === "review_required"
          ? "Human review recommended before approval."
          : "Additional verification needed — data may be missing or mismatched.",
    verifiedAt,
    documentFingerprint: fingerprint,
    runStatus: "completed",
    fieldChecks,
  };
};

export const FINAL_REPORT_AI_TIMELINE_ACTION = FINAL_EVALUATION_TIMELINE_ACTIONS.aiVerified;
