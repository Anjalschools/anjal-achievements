/**
 * Structured admin AI attachment review (evidence vs achievement record).
 */

export type AdminAttachmentMatchValue = "match" | "mismatch" | "unclear";

/** Heuristic attachment class (optional on stored reviews for backward compatibility). */
export type AttachmentDocumentKind =
  | "individual_certificate"
  | "group_list_document"
  | "unknown_document";

/** One parsed row from a roster / nominee list (flat PDF text). */
export type GroupStudentRowCandidate = {
  rawRow: string;
  normalizedRow: string;
  studentName: string | null;
  studentNameNormalized: string | null;
  educationOffice?: string | null;
  schoolName?: string | null;
  grade?: string | null;
  specialization?: string | null;
  field?: string | null;
  section?: string | null;
  rankOrSeat?: string | null;
  confidence: number;
  sourcePage?: number | null;
};

/** Summary when the pipeline treats the file as a group list / circular. */
export type GroupDocumentAnalysis = {
  title?: string | null;
  titleConfidence?: number;
  titleSource?: string;
  studentFound?: boolean;
  matchType?: "strong" | "partial" | "none";
  matchScore?: number;
  matchedRow?: GroupStudentRowCandidate | null;
  rowCount?: number;
  detectionReasons?: string[];
  kindConfidence?: number;
};

export type AdminAttachmentAiChecks = {
  nameCheck: AdminAttachmentMatchValue;
  yearCheck: AdminAttachmentMatchValue;
  levelCheck: AdminAttachmentMatchValue;
  achievementCheck: AdminAttachmentMatchValue;
  /** Optional: medal / rank / participation vs record (backward-compatible when absent). */
  resultCheck?: AdminAttachmentMatchValue;
  /** Group / roster path: document title vs achievement context (optional). */
  documentTitleCheck?: AdminAttachmentMatchValue;
  /** Group path: overall contextual support (name in list + title/year). */
  contextualSupportCheck?: AdminAttachmentMatchValue;
  /** Group path: row metadata (grade, school, etc.) when available. */
  optionalRowDataCheck?: AdminAttachmentMatchValue;
};

export type AdminAttachmentAiExtractedEvidence = {
  detectedStudentName: string | null;
  detectedYear: string | null;
  detectedLevel: string | null;
  detectedAchievementTitle: string | null;
  detectedMedalOrResult: string | null;
  detectedIssuer: string | null;
  notesAr: string;
  notesEn: string;
};

/** One PDF (or analyzed file) outcome; optional on stored payloads for backward compatibility. */
export type AdminAttachmentPerFileReview = {
  attachmentIndex: number;
  fileName?: string | null;
  /** Internal label e.g. primary, attachment-1 */
  label?: string;
  overallMatchStatus: AdminAttachmentMatchValue;
  checks: AdminAttachmentAiChecks;
  extractedEvidence: AdminAttachmentAiExtractedEvidence;
  recommendationAr: string;
  recommendationEn: string;
  analyzedAt: string;
  modelNote?: string;
  detectedDocumentKind?: AttachmentDocumentKind;
  groupDocumentAnalysis?: GroupDocumentAnalysis;
  /** True when PDF text heuristics flagged low reliability for this file only. */
  pdfReliabilityLow?: boolean;
  summaryAr?: string;
  summaryEn?: string;
};

/** Execution lifecycle for auto / manual attachment AI (backward-compatible optional fields). */
export type AiReviewRunStatus = "idle" | "pending" | "processing" | "completed" | "failed";

/** Rule-based final decision (optional on stored payloads). */
export type AiReviewDecision = "accepted" | "accepted_with_warning" | "unclear" | "rejected";

export type AdminAttachmentAiReviewResult = {
  overallMatchStatus: AdminAttachmentMatchValue;
  checks: AdminAttachmentAiChecks;
  extractedEvidence: AdminAttachmentAiExtractedEvidence;
  recommendationAr: string;
  recommendationEn: string;
  analyzedAt: string;
  modelNote?: string;
  /** Set by heuristic pipeline + group review (optional). */
  detectedDocumentKind?: AttachmentDocumentKind;
  /** Populated for group_list_document reviews (optional). */
  groupDocumentAnalysis?: GroupDocumentAnalysis;
  /** When multiple PDFs were analyzed, one entry per file (aggregate fields above remain). */
  attachmentReviews?: AdminAttachmentPerFileReview[];
  overallAttachmentReviewSummaryAr?: string;
  overallAttachmentReviewSummaryEn?: string;
  /** Fingerprint of inputs when this review was produced (invalidation / skip unchanged). */
  aiReviewInputSignature?: string;
  aiReviewRunStatus?: AiReviewRunStatus;
  aiReviewDecision?: AiReviewDecision;
  aiDecisionReasonAr?: string;
  aiDecisionReasonEn?: string;
  aiReviewWarnings?: string[];
  aiMatchedFields?: string[];
  aiMismatchedFields?: string[];
  aiUnclearFields?: string[];
  /** LLM+guardrails overall before deterministic decision (audit). */
  modelOverallMatchStatus?: AdminAttachmentMatchValue;
  aiReviewFailureMessage?: string;
};
