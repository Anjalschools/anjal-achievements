import {
  INSTITUTION_REPORT_RATING_FIELDS,
  type InstitutionReportRatingRowStatus,
  type InstitutionReportValidationResult,
} from "@/lib/partnerships/institution-final-report-constants";

export type InstitutionReportEvidenceRegionId = "stamp" | "signature" | "rating_matrix";

export type InstitutionReportEvidenceBox = {
  topPct: number;
  leftPct: number;
  widthPct: number;
  heightPct: number;
};

export type InstitutionReportVisualEvidenceRegion = {
  id: InstitutionReportEvidenceRegionId;
  labelAr: string;
  labelEn: string;
  pageHint: number;
  detected: boolean;
  examined: boolean;
  confidence?: number;
  messageAr?: string;
  messageEn?: string;
  previewAnchor: string;
  highlight: "success" | "missing" | "neutral";
  box: InstitutionReportEvidenceBox;
};

export type InstitutionReportRatingEvidenceRow = {
  key: string;
  labelAr: string;
  rowStatus: InstitutionReportRatingRowStatus;
  selectedRating?: number;
  checkboxColumn?: number;
  detected: boolean;
  labelEn?: string;
};

export type InstitutionReportConfidenceExplanation = {
  ocrConfidence: number;
  visionConfidence: number;
  overallConfidence: number;
  stampDetectionConfidence?: number;
  signatureDetectionConfidence?: number;
};

export type InstitutionReportVisualEvidence = {
  generatedAt: string;
  reportFileKey?: string;
  regions: InstitutionReportVisualEvidenceRegion[];
  ratingMatrix: InstitutionReportRatingEvidenceRow[];
  confidenceExplanation: InstitutionReportConfidenceExplanation;
};

export type InstitutionReportDetectionFeedback = {
  falsePositiveStamp?: boolean;
  falsePositiveSignature?: boolean;
  falsePositiveRatings?: string[];
  feedbackAt?: string;
  feedbackBy?: string;
};

export type InstitutionReportModelFeedbackEntry = {
  target: "stamp" | "signature" | "rating";
  ratingKey?: string;
  aiDetected: boolean;
  aiConfidence?: number;
  reviewStatus?: string;
  overallConfidence?: number;
  markedAt: string;
  markedBy: string;
};

export type InstitutionReportModelFeedback = {
  entries: InstitutionReportModelFeedbackEntry[];
};

const EVIDENCE_LAYOUT: Record<
  InstitutionReportEvidenceRegionId,
  { pageHint: number; box: InstitutionReportEvidenceBox; labelAr: string; labelEn: string }
> = {
  rating_matrix: {
    pageHint: 2,
    labelAr: "منطقة التقييمات",
    labelEn: "Rating matrix area",
    box: { topPct: 26, leftPct: 7, widthPct: 86, heightPct: 44 },
  },
  stamp: {
    pageHint: 3,
    labelAr: "منطقة الختم",
    labelEn: "Stamp area",
    box: { topPct: 70, leftPct: 6, widthPct: 24, heightPct: 16 },
  },
  signature: {
    pageHint: 3,
    labelAr: "منطقة التوقيع",
    labelEn: "Signature area",
    box: { topPct: 76, leftPct: 52, widthPct: 30, heightPct: 12 },
  },
};

const buildRegion = (
  id: InstitutionReportEvidenceRegionId,
  detected: boolean,
  confidence?: number
): InstitutionReportVisualEvidenceRegion => {
  const layout = EVIDENCE_LAYOUT[id];
  const examined = true;
  const highlight: InstitutionReportVisualEvidenceRegion["highlight"] = detected
    ? "success"
    : "missing";

  let messageAr: string | undefined;
  let messageEn: string | undefined;
  if (id === "stamp" && !detected) {
    messageAr = "لم يتم العثور على ختم في هذه المنطقة.";
    messageEn = "No stamp was found in this examined area.";
  }
  if (id === "signature" && !detected) {
    messageAr = "لم يتم العثور على توقيع في هذه المنطقة.";
    messageEn = "No signature was found in this examined area.";
  }
  if (id === "rating_matrix" && !detected) {
    messageAr = "لم يكتمل فحص جميع بنود التقييم في هذه المنطقة.";
    messageEn = "Not all rating rows were detected in this matrix area.";
  }

  return {
    id,
    labelAr: layout.labelAr,
    labelEn: layout.labelEn,
    pageHint: layout.pageHint,
    detected,
    examined,
    confidence,
    messageAr,
    messageEn,
    previewAnchor: `#page=${layout.pageHint}`,
    highlight,
    box: layout.box,
  };
};

export const buildInstitutionReportVisualEvidence = (input: {
  validationResult: InstitutionReportValidationResult;
  reportFileKey?: string;
}): InstitutionReportVisualEvidence => {
  const { validationResult, reportFileKey } = input;
  const ratingRows = validationResult.ratingRowDetails ?? [];
  const ratingsComplete = validationResult.ratingsDetected >= validationResult.expectedRatings;

  const ratingMatrix: InstitutionReportRatingEvidenceRow[] = INSTITUTION_REPORT_RATING_FIELDS.map((field) => {
    const detail = ratingRows.find((row) => row.key === field.key);
    const rowStatus = detail?.rowStatus ?? "EMPTY";
    const selectedRating = detail?.selectedRating;
    return {
      key: field.key,
      labelAr: field.labelAr,
      labelEn: field.key,
      rowStatus,
      selectedRating,
      checkboxColumn: selectedRating,
      detected: rowStatus === "VALID",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    reportFileKey: reportFileKey || undefined,
    regions: [
      buildRegion("rating_matrix", ratingsComplete, validationResult.overallConfidence ?? validationResult.confidence),
      buildRegion("stamp", validationResult.stampDetected, validationResult.stampConfidence),
      buildRegion("signature", validationResult.signatureDetected, validationResult.signatureConfidence),
    ],
    ratingMatrix,
    confidenceExplanation: {
      ocrConfidence: validationResult.ocrConfidence ?? 0,
      visionConfidence: validationResult.visionConfidence ?? 0,
      overallConfidence: validationResult.overallConfidence ?? validationResult.confidence,
      stampDetectionConfidence: validationResult.stampConfidence,
      signatureDetectionConfidence: validationResult.signatureConfidence,
    },
  };
};

export const resolveInstitutionReportVisualEvidence = (
  extractionMeta: Record<string, unknown> | null | undefined,
  reportFileKey?: string
): InstitutionReportVisualEvidence | null => {
  if (!extractionMeta) return null;

  const stored = extractionMeta.visualEvidence;
  if (stored && typeof stored === "object") {
    return stored as InstitutionReportVisualEvidence;
  }

  const validationResult = extractionMeta.validationResult;
  if (!validationResult || typeof validationResult !== "object") return null;

  return buildInstitutionReportVisualEvidence({
    validationResult: validationResult as InstitutionReportValidationResult,
    reportFileKey: reportFileKey || String(extractionMeta.reportFileKey || ""),
  });
};

export const pickInstitutionReportDetectionFeedback = (
  extractionMeta: Record<string, unknown> | null | undefined
): InstitutionReportDetectionFeedback | null => {
  if (!extractionMeta?.detectionFeedback || typeof extractionMeta.detectionFeedback !== "object") {
    return null;
  }
  return extractionMeta.detectionFeedback as InstitutionReportDetectionFeedback;
};

export const isRatingFalsePositive = (
  feedback: InstitutionReportDetectionFeedback | null | undefined,
  ratingKey: string
) => Boolean(feedback?.falsePositiveRatings?.includes(ratingKey));
