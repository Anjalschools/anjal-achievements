import type { InsightConfidence, InsightSeverity } from "@/lib/analytics/intelligence/analytics-narrative-schema";

const severityPhrasesAr: Record<InsightSeverity, string> = {
  INFO: "تشير البيانات إلى",
  WARNING: "تشير المؤشرات الحالية إلى احتمالية",
  CRITICAL: "تؤكد البيانات وجود",
  OPPORTUNITY: "تبرز البيانات فرصة لـ",
  SUCCESS: "تظهر البيانات",
  STABILITY: "تشير البيانات إلى استقرار في",
};

const severityPhrasesEn: Record<InsightSeverity, string> = {
  INFO: "Current data indicates",
  WARNING: "Indicators suggest a potential",
  CRITICAL: "Data confirms a",
  OPPORTUNITY: "Data highlights an opportunity to",
  SUCCESS: "Data shows",
  STABILITY: "Data indicates stability in",
};

export const executivePhrase = (
  severity: InsightSeverity,
  topic: string,
  isAr: boolean,
  confidence: InsightConfidence
): string => {
  const prefix = isAr ? severityPhrasesAr[severity] : severityPhrasesEn[severity];
  const exploratory = confidence === "EXPLORATORY";
  if (exploratory) {
    return isAr
      ? `إشارة تاريخية جزئية: ${topic} — يُنصح بالتحقق قبل قرار تنفيذي.`
      : `Partial historical signal: ${topic} — verify before executive action.`;
  }
  return `${prefix} ${topic}`;
};

export const softenOverclaim = (text: string, confidence: InsightConfidence, isAr: boolean): string => {
  if (confidence !== "LOW" && confidence !== "EXPLORATORY") return text;
  const suffix = isAr ? " (بحاجة لمزيد من البيانات)" : " (requires more data)";
  if (text.includes(suffix)) return text;
  return `${text}${suffix}`;
};
