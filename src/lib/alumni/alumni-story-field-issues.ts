/** Bilingual field issues for admin alumni story APIs (avoid raw INVALID_INPUT in UI). */
export type AlumniStoryFieldIssue = { ar: string; en: string };

export type StoryIssueSeverity = "error" | "warning";

export type StructuredStoryIssue = {
  errorCode: string;
  field: string;
  localizedMessage: { ar: string; en: string };
  severity: StoryIssueSeverity;
};

export type AlumniStoryFieldIssues = {
  fieldErrors: Record<string, AlumniStoryFieldIssue>;
  structuredIssues?: StructuredStoryIssue[];
};

export const toStructuredStoryIssues = (fieldErrors: Record<string, AlumniStoryFieldIssue>): StructuredStoryIssue[] =>
  Object.entries(fieldErrors).map(([field, msg]) => ({
    errorCode: `ALUMNI_STORY_${field.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`,
    field,
    localizedMessage: { ar: msg.ar, en: msg.en },
    severity: "error" as const,
  }));

export const withStructuredStoryIssues = (fieldErrors: Record<string, AlumniStoryFieldIssue>): AlumniStoryFieldIssues => ({
  fieldErrors,
  structuredIssues: toStructuredStoryIssues(fieldErrors),
});

export const alumniStoryTitleRequiredIssue: AlumniStoryFieldIssues = withStructuredStoryIssues({
  title: {
    ar: "العنوان مطلوب (حرفان على الأقل بعد التنظيف).",
    en: "Title is required (at least 2 characters after sanitization).",
  },
});

export const alumniStoryContentEmptyIssue: AlumniStoryFieldIssues = withStructuredStoryIssues({
  content: {
    ar: "محتوى القصة مطلوب ولا يمكن أن يكون فارغًا أو مسافات فقط.",
    en: "Story content is required and cannot be empty or whitespace-only.",
  },
});
