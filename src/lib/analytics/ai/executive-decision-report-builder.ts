import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";

export type ExecutiveDecisionReportSection = {
  titleAr: string;
  titleEn: string;
  rows: Array<{ labelAr: string; labelEn: string; value: string }>;
};

export const buildExecutiveDecisionReportSections = (
  result: AiDecisionEngineResult
): ExecutiveDecisionReportSection[] => {
  const { bundle, boardSummary } = result;
  return [
    {
      titleAr: "أولويات استراتيجية",
      titleEn: "Strategic priorities",
      rows: bundle.topPriorities.map((d) => ({
        labelAr: d.titleAr,
        labelEn: d.titleEn,
        value: d.executiveSummaryAr,
      })),
    },
    {
      titleAr: "مخاطر مؤسسية",
      titleEn: "Institutional risks",
      rows: bundle.criticalRisks.map((d) => ({
        labelAr: d.titleAr,
        labelEn: d.titleEn,
        value: d.executiveSummaryAr,
      })),
    },
    {
      titleAr: "ملخص مجلس الإدارة",
      titleEn: "Board summary",
      rows: [
        { labelAr: "العنوان", labelEn: "Headline", value: boardSummary.headlineAr },
        { labelAr: "أفضل استثمار", labelEn: "Best investment", value: boardSummary.bestInvestmentAr },
      ],
    },
  ];
};
