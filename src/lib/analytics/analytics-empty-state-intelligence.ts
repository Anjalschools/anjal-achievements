export type EmptyStateKind =
  | "no_compatible_data"
  | "insufficient_historical"
  | "incompatible_filters"
  | "no_outcome_records"
  | "exploratory";

export type ExecutiveEmptyState = {
  kind: EmptyStateKind;
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  suggestionsAr: string[];
  suggestionsEn: string[];
};

export const resolveExecutiveEmptyState = (input: {
  hasPartialSignal?: boolean;
  hasParticipation?: boolean;
  hasOutcomes?: boolean;
  filterCount?: number;
}): ExecutiveEmptyState => {
  if (input.hasPartialSignal) {
    return {
      kind: "exploratory",
      titleAr: "إشارة تاريخية جزئية",
      titleEn: "Partial historical signal",
      reasonAr: "توجد مشاركات لكن بيانات النتائج غير مكتملة ضمن الفلاتر الحالية.",
      reasonEn: "Participation exists but outcome data is incomplete under current filters.",
      suggestionsAr: ["وسّع نطاق السنوات", "أزل فلتر النتيجة", "جرّب بعدًا مجمّعًا"],
      suggestionsEn: ["Expand years", "Remove outcome filter", "Try combined dimension"],
    };
  }
  if (input.hasParticipation && !input.hasOutcomes) {
    return {
      kind: "no_outcome_records",
      titleAr: "لا توجد سجلات نتائج",
      titleEn: "No outcome records",
      reasonAr: "المشاركة مسجّلة دون نتائج/تتويج مرتبطة في النطاق المحدد.",
      reasonEn: "Participation is recorded without linked awards or qualifications in scope.",
      suggestionsAr: ["تحقق من ربط الإنجازات بالمسابقة", "راجع حالة الاعتماد"],
      suggestionsEn: ["Verify achievement linkage", "Review approval status"],
    };
  }
  if ((input.filterCount ?? 0) > 4) {
    return {
      kind: "incompatible_filters",
      titleAr: "فلاتر ضيقة جدًا",
      titleEn: "Filters too narrow",
      reasonAr: "مجموعة الفلاتر الحالية قد تستبعد معظم السجلات.",
      reasonEn: "Current filter combination may exclude most records.",
      suggestionsAr: ["أزل فلترًا واحدًا في كل مرة", "استخدم «الكل» في التصنيف"],
      suggestionsEn: ["Remove one filter at a time", "Use «All» for category"],
    };
  }
  return {
    kind: "no_compatible_data",
    titleAr: "لا توجد بيانات متوافقة",
    titleEn: "No compatible data",
    reasonAr: "لا توجد سجلات تطابق معايير العرض الحالية.",
    reasonEn: "No records match the current view criteria.",
    suggestionsAr: ["وسّع السنوات", "غيّر النشاط أو القسم", "أعد ضبط الفلاتر"],
    suggestionsEn: ["Expand years", "Change activity or section", "Reset filters"],
  };
};
