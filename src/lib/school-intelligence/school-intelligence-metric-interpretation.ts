export type MetricInterpretation = {
  labelAr: string;
  labelEn: string;
  tone: "excellent" | "strong" | "good" | "fair" | "weak";
};

export const interpretHealthScore = (score: number): MetricInterpretation => {
  if (score >= 90) {
    return { labelAr: "ممتاز", labelEn: "Excellent", tone: "excellent" };
  }
  if (score >= 75) {
    return { labelAr: "جيد جداً", labelEn: "Very good", tone: "strong" };
  }
  if (score >= 60) {
    return { labelAr: "جيد", labelEn: "Good", tone: "good" };
  }
  if (score >= 40) {
    return { labelAr: "يحتاج تحسين", labelEn: "Needs improvement", tone: "fair" };
  }
  return { labelAr: "ضعيف", labelEn: "Weak", tone: "weak" };
};

export const interpretIntelligenceScore = (score: number): MetricInterpretation => {
  if (score >= 90) {
    return { labelAr: "تحليلات متقدمة جداً", labelEn: "Highly advanced analytics", tone: "excellent" };
  }
  if (score >= 75) {
    return { labelAr: "تحليلات قوية", labelEn: "Strong analytics", tone: "strong" };
  }
  if (score >= 60) {
    return { labelAr: "تحليلات مقبولة", labelEn: "Acceptable analytics", tone: "good" };
  }
  return {
    labelAr: "بيانات غير كافية لاتخاذ قرارات استراتيجية كاملة",
    labelEn: "Insufficient data for full strategic decisions",
    tone: "weak",
  };
};

export const interpretSsi = (score: number): MetricInterpretation => {
  if (score >= 30) {
    return { labelAr: "متميز", labelEn: "Outstanding", tone: "excellent" };
  }
  if (score >= 20) {
    return { labelAr: "مرتفع", labelEn: "High", tone: "strong" };
  }
  if (score >= 10) {
    return { labelAr: "متوسط", labelEn: "Moderate", tone: "good" };
  }
  return { labelAr: "منخفض", labelEn: "Low", tone: "weak" };
};

export const interpretParticipationRate = (ratePct: number): MetricInterpretation => {
  if (ratePct >= 25) {
    return { labelAr: "ممتاز", labelEn: "Excellent", tone: "excellent" };
  }
  if (ratePct >= 15) {
    return { labelAr: "جيد", labelEn: "Good", tone: "good" };
  }
  if (ratePct >= 5) {
    return { labelAr: "منخفض", labelEn: "Low", tone: "fair" };
  }
  return { labelAr: "ضعيف", labelEn: "Weak", tone: "weak" };
};

export const interpretSnapshotStatus = (
  status: string,
  isAr: boolean
): string => {
  if (status === "healthy") return isAr ? "سليم" : "Healthy";
  if (status === "degraded") return isAr ? "يعمل بنسخة محفوظة" : "Degraded";
  if (status === "failed") return isAr ? "فشل الحفظ" : "Failed";
  if (status === "skipped") return isAr ? "تم التخطي" : "Skipped";
  return isAr ? "غير معروف" : "Unknown";
};

export const interpretDiagnosticsStatus = (status: string, isAr: boolean): string => {
  if (status === "healthy") return isAr ? "سليم" : "Healthy";
  if (status === "partial") return isAr ? "جزئي" : "Partial";
  return isAr ? "مفقود" : "Missing";
};

export const interpretBuildStatus = (status: string, isAr: boolean): string => {
  if (status === "success") return isAr ? "ناجح" : "Success";
  if (status === "degraded") return isAr ? "يعمل بنسخة محفوظة" : "Degraded";
  return isAr ? "غير متاح" : "Unavailable";
};

export const interpretationToneClass = (tone: MetricInterpretation["tone"]): string => {
  if (tone === "excellent" || tone === "strong") return "text-emerald-700";
  if (tone === "good") return "text-blue-700";
  if (tone === "fair") return "text-amber-700";
  return "text-red-700";
};
