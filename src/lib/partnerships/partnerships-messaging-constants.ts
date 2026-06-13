export const INSTITUTION_DECISION_STATUSES = [
  "institution_pending",
  "institution_interview",
  "institution_accepted",
  "institution_rejected",
  "institution_training_evaluated",
  "institution_student_feedback",
] as const;
export type InstitutionDecisionStatus = (typeof INSTITUTION_DECISION_STATUSES)[number];

export const PARTNERSHIP_MESSAGE_TEMPLATES = [
  "interview_invite",
  "test_invite",
  "documents_completion",
  "preliminary_acceptance",
  "final_acceptance",
  "apology",
] as const;
export type PartnershipMessageTemplateKey = (typeof PARTNERSHIP_MESSAGE_TEMPLATES)[number];

export const PARTNERSHIP_BULK_TARGETS = [
  "accepted",
  "rejected",
  "awaiting_interview",
] as const;
export type PartnershipBulkTarget = (typeof PARTNERSHIP_BULK_TARGETS)[number];

export const PARTNERSHIP_MESSAGE_TEMPLATE_LABELS: Record<
  PartnershipMessageTemplateKey,
  { ar: string; en: string; defaultBodyAr: string; defaultBodyEn: string }
> = {
  interview_invite: {
    ar: "دعوة مقابلة",
    en: "Interview invitation",
    defaultBodyAr: "نود دعوتك لحضور مقابلة ضمن برنامج التدريب الصيفي. سيتم التواصل معك لتحديد الموعد.",
    defaultBodyEn: "You are invited to an interview for the summer training program. We will contact you to schedule the time.",
  },
  test_invite: {
    ar: "دعوة اختبار",
    en: "Test invitation",
    defaultBodyAr: "نود دعوتك لاجتياز اختبار ضمن مرحلة التقييم للتدريب الصيفي.",
    defaultBodyEn: "You are invited to complete an assessment as part of the summer training evaluation.",
  },
  documents_completion: {
    ar: "استكمال مستندات",
    en: "Complete documents",
    defaultBodyAr: "يرجى استكمال المستندات المطلوبة لمتابعة طلب التدريب.",
    defaultBodyEn: "Please complete the required documents to continue your training application.",
  },
  preliminary_acceptance: {
    ar: "قبول مبدئي",
    en: "Preliminary acceptance",
    defaultBodyAr: "يسعدنا إبلاغك بقبولك مبدئياً في برنامج التدريب الصيفي.",
    defaultBodyEn: "We are pleased to inform you of your preliminary acceptance in the summer training program.",
  },
  final_acceptance: {
    ar: "قبول نهائي",
    en: "Final acceptance",
    defaultBodyAr: "تهانينا! تم اعتمادك نهائياً في فرصة التدريب الصيفي.",
    defaultBodyEn: "Congratulations! You have been finally accepted for the summer training opportunity.",
  },
  apology: {
    ar: "اعتذار",
    en: "Apology",
    defaultBodyAr: "نعتذر عن عدم قبول طلبك في فرصة التدريب الحالية، ونتمنى لك التوفيق.",
    defaultBodyEn: "We regret that your application was not accepted for this training opportunity. We wish you success.",
  },
};

export const INSTITUTION_DECISION_LABELS: Record<InstitutionDecisionStatus, { ar: string; en: string }> = {
  institution_pending: { ar: "بانتظار قرار المؤسسة", en: "Pending institution review" },
  institution_interview: { ar: "مقابلة المؤسسة", en: "Institution interview" },
  institution_accepted: { ar: "مقبول من المؤسسة", en: "Accepted by institution" },
  institution_rejected: { ar: "مرفوض من المؤسسة", en: "Rejected by institution" },
  institution_training_evaluated: { ar: "تقييم التدريب", en: "Training evaluation" },
  institution_student_feedback: { ar: "تقييم الطالب للمؤسسة", en: "Student institution feedback" },
};

export const templateTimelineAction = (templateKey: PartnershipMessageTemplateKey): string => {
  const map: Record<PartnershipMessageTemplateKey, string> = {
    interview_invite: "message_interview_invite",
    test_invite: "message_test_invite",
    documents_completion: "message_documents_request",
    preliminary_acceptance: "message_preliminary_acceptance",
    final_acceptance: "message_final_acceptance",
    apology: "message_apology",
  };
  return map[templateKey];
};
