import type { AiDecisionBundle, ExecutiveBoardSummary, ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";
import { aggregateInstitutionalBenefit } from "@/lib/analytics/ai/strategic-impact-model";

export const buildExecutiveBoardSummary = (bundle: AiDecisionBundle): ExecutiveBoardSummary => {
  const top = bundle.topPriorities[0];
  const risk = bundle.criticalRisks[0];
  const opp = bundle.highImpactOpportunities[0];
  const benefit = aggregateInstitutionalBenefit(bundle.decisions);

  return {
    headlineAr: top
      ? `أولوية تنفيذية: ${top.titleAr}`
      : "لا توجد قرارات كافية ضمن الفلاتر الحالية",
    headlineEn: top ? `Executive priority: ${top.titleEn}` : "Insufficient signal under current filters",
    topPriorityAr: top?.executiveSummaryAr ?? "—",
    topPriorityEn: top?.executiveSummaryEn ?? "—",
    greatestRiskAr: risk?.executiveSummaryAr ?? "لا خطر حرج مُحدد",
    greatestRiskEn: risk?.executiveSummaryEn ?? "No critical risk identified",
    bestInvestmentAr: opp?.executiveSummaryAr ?? "—",
    bestInvestmentEn: opp?.executiveSummaryEn ?? "—",
    resourceFocusAr: opp?.affectedDimensions.join(" · ") || "توسيع المشاركة في الأنشطة عالية الأثر",
    resourceFocusEn: opp?.affectedDimensions.join(" · ") || "Expand high-impact activity participation",
    ...(benefit > 0 ? {} : {}),
  };
};

export const answerExecutiveQuestions = (
  bundle: AiDecisionBundle,
  isAr: boolean
): Array<{ q: string; a: string }> => {
  const s = buildExecutiveBoardSummary(bundle);
  const top = bundle.topPriorities[0];
  return [
    {
      q: isAr ? "ما أهم قرار الآن؟" : "Top decision now?",
      a: isAr ? s.topPriorityAr : s.topPriorityEn,
    },
    {
      q: isAr ? "ما أكبر خطر؟" : "Greatest risk?",
      a: isAr ? s.greatestRiskAr : s.greatestRiskEn,
    },
    {
      q: isAr ? "أفضل استثمار؟" : "Best investment?",
      a: isAr ? s.bestInvestmentAr : s.bestInvestmentEn,
    },
    {
      q: isAr ? "أين نوجّه الموارد؟" : "Resource focus?",
      a: isAr ? s.resourceFocusAr : s.resourceFocusEn,
    },
    {
      q: isAr ? "أعلى أثر سنوي؟" : "Highest yearly impact?",
      a: top?.impactSimulation
        ? `${top.impactSimulation.institutionalBenefitScore}/100`
        : "—",
    },
  ];
};
