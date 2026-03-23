/**
 * Structured admin AI attachment review (evidence vs achievement record).
 */

export type AdminAttachmentMatchValue = "match" | "mismatch" | "unclear";

export type AdminAttachmentAiChecks = {
  nameCheck: AdminAttachmentMatchValue;
  yearCheck: AdminAttachmentMatchValue;
  levelCheck: AdminAttachmentMatchValue;
  achievementCheck: AdminAttachmentMatchValue;
};

export type AdminAttachmentAiExtractedEvidence = {
  detectedStudentName: string | null;
  detectedYear: string | null;
  detectedLevel: string | null;
  detectedAchievementTitle: string | null;
  notesAr: string;
  notesEn: string;
};

export type AdminAttachmentAiReviewResult = {
  overallMatchStatus: AdminAttachmentMatchValue;
  checks: AdminAttachmentAiChecks;
  extractedEvidence: AdminAttachmentAiExtractedEvidence;
  recommendationAr: string;
  recommendationEn: string;
  analyzedAt: string;
  modelNote?: string;
};
