export const INSTITUTION_PIPELINE_STAGES = [
  "new",
  "inReview",
  "awaitingDocuments",
  "awaitingInterview",
  "awaitingDecision",
  "accepted",
  "rejected",
  "inTraining",
  "completed",
] as const;

export type InstitutionPipelineStage = (typeof INSTITUTION_PIPELINE_STAGES)[number];

export const INSTITUTION_PIPELINE_STAGE_LABELS: Record<
  InstitutionPipelineStage,
  { ar: string; en: string }
> = {
  new: { ar: "طلاب جدد", en: "New candidates" },
  inReview: { ar: "قيد المراجعة", en: "In review" },
  awaitingDocuments: { ar: "بانتظار مستندات", en: "Awaiting documents" },
  awaitingInterview: { ar: "بانتظار مقابلة", en: "Awaiting interview" },
  awaitingDecision: { ar: "بانتظار قرار", en: "Awaiting decision" },
  accepted: { ar: "مقبولون", en: "Accepted" },
  rejected: { ar: "مرفوضون", en: "Rejected" },
  inTraining: { ar: "متدربون حالياً", en: "Currently training" },
  completed: { ar: "مكتملون", en: "Completed" },
};

export const PREDEFINED_CANDIDATE_TAGS = [
  "talented",
  "leadership",
  "technical",
  "creative",
  "program_fit",
  "needs_extra_interview",
  "reserve",
  "high_priority",
] as const;

export type PredefinedCandidateTag = (typeof PREDEFINED_CANDIDATE_TAGS)[number];

export const CANDIDATE_TAG_LABELS: Record<PredefinedCandidateTag, { ar: string; en: string }> = {
  talented: { ar: "موهوب", en: "Talented" },
  leadership: { ar: "قيادي", en: "Leadership" },
  technical: { ar: "تقني", en: "Technical" },
  creative: { ar: "إبداعي", en: "Creative" },
  program_fit: { ar: "مناسب للبرنامج", en: "Program fit" },
  needs_extra_interview: { ar: "يحتاج مقابلة إضافية", en: "Needs extra interview" },
  reserve: { ar: "احتياطي", en: "Reserve" },
  high_priority: { ar: "أولوية عالية", en: "High priority" },
};

export const INSTITUTION_PRIVATE_NOTE_CATEGORIES = [
  "evaluation",
  "interview",
  "strengths",
  "weaknesses",
  "recommendation",
  "professional_observations",
  "communication_notes",
  "general",
] as const;

export type InstitutionPrivateNoteCategory = (typeof INSTITUTION_PRIVATE_NOTE_CATEGORIES)[number];

export const PRIVATE_NOTE_CATEGORY_LABELS: Record<
  InstitutionPrivateNoteCategory,
  { ar: string; en: string }
> = {
  evaluation: { ar: "ملاحظات تقييم", en: "Evaluation notes" },
  interview: { ar: "ملاحظات المقابلة", en: "Interview notes" },
  strengths: { ar: "نقاط القوة", en: "Strengths" },
  weaknesses: { ar: "مجالات التحسين", en: "Areas for improvement" },
  recommendation: { ar: "التوصيات", en: "Recommendations" },
  professional_observations: { ar: "ملاحظات مهنية", en: "Professional observations" },
  communication_notes: { ar: "ملاحظات التواصل", en: "Communication notes" },
  general: { ar: "مخصص / عام", en: "Custom / general" },
};

export const CANDIDATE_TIMELINE_ACTIONS = {
  documentRequested: "document_requested",
  documentUploaded: "document_uploaded",
  interviewCompleted: "interview_completed",
  candidateTagAdded: "candidate_tag_added",
  candidateNoteAdded: "candidate_note_added",
  candidateCompared: "candidate_compared",
} as const;

export const STANDARD_DOCUMENT_KEYS = [
  "cv",
  "intro_video",
  "motivation_letter",
  "portfolio",
] as const;

export const STANDARD_DOCUMENT_LABELS: Record<
  (typeof STANDARD_DOCUMENT_KEYS)[number],
  { ar: string; en: string }
> = {
  cv: { ar: "السيرة الذاتية", en: "CV" },
  intro_video: { ar: "الفيديو التعريفي", en: "Introduction video" },
  motivation_letter: { ar: "خطاب الدافع", en: "Motivation letter" },
  portfolio: { ar: "ملف الأعمال", en: "Portfolio" },
};
