import type { AiDecisionConfidence, ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";
import { downgradedWording } from "@/lib/analytics/ai/ai-decision-confidence";
import { softenSeverityForLowConfidence } from "@/lib/analytics/ai/ai-decision-severity";

export const buildDecisionExplainability = (input: {
  decision: Omit<ExecutiveAiDecision, "explainability">;
  filterScope: string;
  confidence: AiDecisionConfidence;
}): ExecutiveAiDecision["explainability"] => {
  const exploratory = input.confidence === "EXPLORATORY" || input.confidence === "LOW";
  const metrics = input.decision.sourceMetrics.join(", ") || "—";
  const insights = input.decision.sourceInsights.join(", ") || "—";

  return {
    whyCreatedAr: exploratory
      ? `إشارة استكشافية مبنية على ${metrics} ضمن نطاق: ${input.filterScope}.`
      : `قرار مستمد من مؤشرات (${metrics}) ورؤى (${insights}) ضمن الفلاتر الحالية.`,
    whyCreatedEn: exploratory
      ? `Exploratory signal from ${metrics} under filter scope: ${input.filterScope}.`
      : `Decision derived from metrics (${metrics}) and insights (${insights}) under current filters.`,
    supportingTrends: input.decision.evidence.filter((e) => e.includes("trend") || e.includes("year")),
    filterScope: input.filterScope,
    confidenceNoteAr: exploratory
      ? "ثقة محدودة — يُنصح بتوسيع النطاق أو التحقق قبل التنفيذ."
      : "مستوى ثقة مبني على اتساق الأدلة وعدد المؤشرات الداعمة.",
    confidenceNoteEn: exploratory
      ? "Limited confidence — broaden scope or validate before execution."
      : "Confidence reflects evidence consistency and supporting metric count.",
    risksAr: exploratory
      ? ["قرار استكشافي قد يتغير عند تغيير الفلاتر", "لا يُعدّ قرارًا نهائيًا"]
      : input.decision.severity === "CRITICAL"
        ? ["تأخير التنفيذ قد يفاقم الفجوة", "يتطلب متابعة تنفيذية"]
        : [],
    risksEn: exploratory
      ? ["Exploratory — may shift when filters change", "Not a final commitment"]
      : input.decision.severity === "CRITICAL"
        ? ["Delayed action may widen the gap", "Requires executive follow-up"]
        : [],
    assumptionsAr: [
      "البيانات المعروضة تعكس الفلاتر الحالية فقط",
      "لا يُفترض وجود بيانات غير مسجّلة في النظام",
    ],
    assumptionsEn: [
      "Displayed data reflects current filters only",
      "Assumes no unrecorded achievements outside scope",
    ],
    limitationsAr: downgradedWording(input.confidence)
      ? ["لا يُستخدم للادعاءات القطعية", "يحتاج تحققًا إضافيًا عند الثقة المنخفضة"]
      : ["مقيّد بنطاق الفلاتر الحالية"],
    limitationsEn: downgradedWording(input.confidence)
      ? ["Not for definitive claims", "Additional validation needed at low confidence"]
      : ["Bounded to current filter scope"],
  };
};

export const applyExplainabilityGuardrails = (decision: ExecutiveAiDecision): ExecutiveAiDecision => {
  const exploratory = decision.confidence === "EXPLORATORY" || decision.confidence === "LOW";
  if (!exploratory) return decision;
  return {
    ...decision,
    severity: softenSeverityForLowConfidence(decision.severity, true),
    executiveSummaryAr: `【استكشافي】 ${decision.executiveSummaryAr}`,
    executiveSummaryEn: `[Exploratory] ${decision.executiveSummaryEn}`,
    titleAr: decision.titleAr,
    titleEn: decision.titleEn,
  };
};
