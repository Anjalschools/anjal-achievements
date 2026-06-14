export const INSTITUTION_SUPERVISOR_INQUIRY_TYPE = "institution_supervisor_channel";

export const INSTITUTION_QUICK_ACTION_TEMPLATES = {
  request_cv: {
    ar: "يرجى رفع سيرتك الذاتية المحدثة لاستكمال مراجعة طلب التدريب.",
    en: "Please upload your updated CV to complete the training application review.",
    requirementTitleAr: "سيرة ذاتية",
    requirementTitleEn: "CV",
  },
  request_intro_video: {
    ar: "يرجى رفع فيديو تعريفي قصير يوضح مهاراتك واهتماماتك المهنية.",
    en: "Please upload a short introduction video about your skills and interests.",
    requirementTitleAr: "فيديو تعريفي",
    requirementTitleEn: "Introduction video",
  },
  request_motivation_letter: {
    ar: "يرجى رفع خطاب الدافع لفرصة التدريب.",
    en: "Please upload your motivation letter for this training opportunity.",
    requirementTitleAr: "خطاب دافع",
    requirementTitleEn: "Motivation letter",
  },
  request_portfolio: {
    ar: "يرجى رفع ملف أعمال يعرض مشاريعك أو أعمالك السابقة.",
    en: "Please upload a portfolio showcasing your projects or prior work.",
    requirementTitleAr: "ملف أعمال",
    requirementTitleEn: "Portfolio",
  },
} as const;

export type InstitutionQuickActionKey = keyof typeof INSTITUTION_QUICK_ACTION_TEMPLATES;

export const DEFAULT_INSTITUTION_NOTIFICATION_SETTINGS = {
  newStudents: true,
  interviews: true,
  documents: true,
  messages: true,
  decisions: true,
  finalReports: true,
} as const;

export type InstitutionNotificationSettings = {
  newStudents: boolean;
  interviews: boolean;
  documents: boolean;
  messages: boolean;
  decisions: boolean;
  finalReports: boolean;
};
