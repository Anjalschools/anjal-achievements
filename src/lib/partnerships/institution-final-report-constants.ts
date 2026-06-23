export const INSTITUTION_REPORT_SOURCES = ["portal", "uploaded_pdf", "uploaded_scan"] as const;
export type InstitutionReportSource = (typeof INSTITUTION_REPORT_SOURCES)[number];

export const INSTITUTION_REPORT_UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png";
export const INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE = 75;
export const INSTITUTION_REPORT_EXPECTED_RATING_COUNT = 10;

export const INSTITUTION_REPORT_RATING_FIELDS = [
  {
    key: "attendanceRating",
    labelAr: "الالتزام بالحضور",
    category: "professional_commitment",
    labelPatterns: [/الالتزام\s*بالحضور/i, /attendance/i],
  },
  {
    key: "disciplineRating",
    labelAr: "الانضباط المهني",
    category: "professional_commitment",
    labelPatterns: [/الانضباط\s*المهني/i, /discipline/i],
  },
  {
    key: "ethicsRating",
    labelAr: "الأخلاقيات المهنية",
    category: "professional_commitment",
    labelPatterns: [/الأخلاقيات\s*المهنية/i, /ethics/i],
  },
  {
    key: "communicationRating",
    labelAr: "التواصل",
    category: "personal_skills",
    labelPatterns: [/التواصل/i, /communication/i],
  },
  {
    key: "teamworkRating",
    labelAr: "العمل الجماعي",
    category: "personal_skills",
    labelPatterns: [/العمل\s*الجماعي/i, /teamwork/i],
  },
  {
    key: "initiativeRating",
    labelAr: "المبادرة",
    category: "personal_skills",
    labelPatterns: [/المبادرة/i, /initiative/i],
  },
  {
    key: "technicalSkillsRating",
    labelAr: "المهارات التقنية",
    category: "work_performance",
    labelPatterns: [/المهارات\s*التقنية/i, /technical/i],
  },
  {
    key: "problemSolvingRating",
    labelAr: "حل المشكلات",
    category: "work_performance",
    labelPatterns: [/حل\s*المشكلات/i, /problem/i],
  },
  {
    key: "taskExecutionRating",
    labelAr: "جودة تنفيذ المهام",
    category: "work_performance",
    labelPatterns: [/جودة\s*تنفيذ\s*المهام/i, /task execution/i],
  },
  {
    key: "safetyRating",
    labelAr: "اتباع أنظمة السلامة",
    category: "safety",
    labelPatterns: [/اتباع\s*أنظمة\s*السلامة/i, /safety/i],
  },
] as const;

export type InstitutionReportRiskFlag =
  | "MISSING_STAMP"
  | "MISSING_SIGNATURE"
  | "MISSING_RATINGS"
  | "MISSING_EVALUATIONS"
  | "MULTIPLE_SELECTIONS"
  | "INVALID_RATING_ROW"
  | "OCR_FAILED"
  | "AI_REVIEW_FAILED"
  | "APPROVAL_INCOMPLETE";

export type InstitutionReportReviewStatus = "APPROVED" | "REQUIRES_REVIEW";

export type InstitutionReportRatingRowStatus = "VALID" | "EMPTY" | "MULTIPLE";

export type InstitutionReportRatingRowDetail = {
  key: string;
  labelAr: string;
  rowStatus: InstitutionReportRatingRowStatus;
  selectedRating?: number;
};

export type InstitutionReportValidationResult = {
  ratingsDetected: number;
  expectedRatings: number;
  missingRatings: number;
  missingRatingKeys: string[];
  invalidRatingRows: string[];
  stampDetected: boolean;
  signatureDetected: boolean;
  recommendationDetected: boolean;
  approvalFieldsDetected: {
    supervisorName: boolean;
    positionTitle: boolean;
    signature: boolean;
  };
  approvalComplete: boolean;
  confidence: number;
  ocrConfidence?: number;
  visionConfidence?: number;
  overallConfidence?: number;
  stampConfidence?: number;
  signatureConfidence?: number;
  extractionMethod?: "OCR" | "VISION" | "HYBRID";
  ratingRowDetails?: InstitutionReportRatingRowDetail[];
  reviewStatus: InstitutionReportReviewStatus;
  riskFlags: InstitutionReportRiskFlag[];
  warnings: string[];
};

export type InstitutionFinalReportRecommendation =
  | "strongly_recommended"
  | "recommended"
  | "not_recommended";

export type InstitutionFinalReportExtractedFields = {
  supervisorName?: string;
  contactNumber?: string;
  positionTitle?: string;
  attendanceRating?: number;
  disciplineRating?: number;
  ethicsRating?: number;
  communicationRating?: number;
  teamworkRating?: number;
  initiativeRating?: number;
  technicalSkillsRating?: number;
  problemSolvingRating?: number;
  taskExecutionRating?: number;
  safetyRating?: number;
  assignedTasks?: string;
  achievements?: string;
  strengths?: string;
  improvementAreas?: string;
  recommendation?: InstitutionFinalReportRecommendation;
};

export type InstitutionFinalReportExtractionResult = InstitutionFinalReportExtractedFields & {
  confidenceScore: number;
  ocrConfidence?: number;
  visionConfidence?: number;
  overallConfidence?: number;
  hasSignature: boolean;
  hasStamp: boolean;
  ocrTextPreview?: string;
  extractionMethod: "ocr" | "vision" | "hybrid" | "heuristic";
  visionVerification?: import("@/lib/partnerships/institution-final-report-vision-shared").InstitutionReportVisionVerification;
  validationResult?: InstitutionReportValidationResult;
};

export const formatInstitutionReportExtractionMethod = (
  method: InstitutionFinalReportExtractionResult["extractionMethod"] | undefined
): "OCR" | "VISION" | "HYBRID" => {
  if (method === "vision") return "VISION";
  if (method === "hybrid") return "HYBRID";
  return "OCR";
};

export const isInstitutionReportSource = (value: unknown): value is InstitutionReportSource =>
  typeof value === "string" && INSTITUTION_REPORT_SOURCES.includes(value as InstitutionReportSource);

export const inferInstitutionReportSourceFromMime = (
  fileName: string,
  mimeType?: string
): "uploaded_pdf" | "uploaded_scan" => {
  const name = String(fileName || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "uploaded_pdf";
  return "uploaded_scan";
};

export const recommendationToLegacyRating = (
  recommendation?: InstitutionFinalReportRecommendation
): number | undefined => {
  if (recommendation === "strongly_recommended") return 5;
  if (recommendation === "recommended") return 4;
  if (recommendation === "not_recommended") return 2;
  return undefined;
};
