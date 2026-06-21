import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type { SchoolIntelligenceFinalReadinessDiagnostics } from "@/lib/school-intelligence/school-intelligence-final-readiness";
import { confidenceFromEvidenceCount } from "@/lib/school-intelligence/school-intelligence-confidence";

export type SchoolIntelligenceExecutiveSummaryItem = {
  ar: string;
  en: string;
  confidence?: number;
};

export type SchoolIntelligenceExecutiveSummary = {
  strengths: SchoolIntelligenceExecutiveSummaryItem[];
  risks: SchoolIntelligenceExecutiveSummaryItem[];
  opportunities: SchoolIntelligenceExecutiveSummaryItem[];
  recommendations: SchoolIntelligenceExecutiveSummaryItem[];
  growthTrends: SchoolIntelligenceExecutiveSummaryItem[];
};

const limitItems = (items: SchoolIntelligenceExecutiveSummaryItem[], max = 5) =>
  items.filter((item) => item.ar || item.en).slice(0, max);

const pushStrength = (
  items: SchoolIntelligenceExecutiveSummaryItem[],
  ar: string,
  en: string,
  confidence?: number
) => {
  items.push({ ar, en, confidence });
};

export const buildSchoolIntelligenceExecutiveSummary = (input: {
  intelligence: SchoolIntelligencePayload;
  readiness: SchoolIntelligenceFinalReadinessDiagnostics;
}): SchoolIntelligenceExecutiveSummary => {
  const { intelligence, readiness } = input;
  const strengths: SchoolIntelligenceExecutiveSummaryItem[] = [];
  const risks: SchoolIntelligenceExecutiveSummaryItem[] = [];
  const opportunities: SchoolIntelligenceExecutiveSummaryItem[] = [];
  const recommendations: SchoolIntelligenceExecutiveSummaryItem[] = [];
  const growthTrends: SchoolIntelligenceExecutiveSummaryItem[] = [];

  if (readiness.healthScore >= 80) {
    pushStrength(
      strengths,
      `مؤشر الصحة ${readiness.healthScore}/100 يعكس استقراراً تشغيلياً عالياً.`,
      `Health score ${readiness.healthScore}/100 reflects strong operational stability.`,
      confidenceFromEvidenceCount(1, readiness.availableSections, 90)
    );
  }

  if (readiness.intelligenceScore >= 80) {
    pushStrength(
      strengths,
      `مؤشر الذكاء ${readiness.intelligenceScore}/100 يدعم قرارات تحليلية متقدمة.`,
      `Intelligence score ${readiness.intelligenceScore}/100 supports advanced analytical decisions.`,
      confidenceFromEvidenceCount(1, readiness.availableSections, 92)
    );
  }

  if (intelligence.strategicInsights.length > 0) {
    pushStrength(
      strengths,
      `${intelligence.strategicInsights.length} رؤية استراتيجية جاهزة للعرض على القيادة.`,
      `${intelligence.strategicInsights.length} strategic insights ready for leadership review.`,
      confidenceFromEvidenceCount(intelligence.strategicInsights.length, 10, 86)
    );
  }

  if (intelligence.schoolExcellence.excellenceIndex >= 60) {
    pushStrength(
      strengths,
      `مؤشر تميز المدرسة ${intelligence.schoolExcellence.excellenceIndex} يعكس أداءً مؤسسياً قوياً.`,
      `School excellence index ${intelligence.schoolExcellence.excellenceIndex} shows strong institutional performance.`,
      confidenceFromEvidenceCount(2, intelligence.schoolExcellence.totalStudents, 84)
    );
  }

  if (intelligence.studentSuccessGraph.avgSuccessIndex >= 20) {
    pushStrength(
      strengths,
      `متوسط SSI ${intelligence.studentSuccessGraph.avgSuccessIndex} يشير إلى قاعدة طلابية ناجحة.`,
      `Average SSI ${intelligence.studentSuccessGraph.avgSuccessIndex} indicates a successful student base.`,
      confidenceFromEvidenceCount(2, intelligence.studentSuccessGraph.totalNodes, 82)
    );
  }

  if (readiness.noDataSections > 0) {
    risks.push({
      ar: `${readiness.noDataSections} قسم(أقسام) يعمل بدون بيانات كافية — منها اكتشاف المواهب.`,
      en: `${readiness.noDataSections} section(s) operate with insufficient data, including talent discovery.`,
      confidence: confidenceFromEvidenceCount(1, readiness.noDataSections, 76),
    });
  }

  if (intelligence.interventions.length > 0) {
    risks.push({
      ar: `${intelligence.interventions.length} طالب(طلاب) يحتاج(ون) تدخلاً دعمياً.`,
      en: `${intelligence.interventions.length} student(s) require supportive intervention.`,
      confidence: confidenceFromEvidenceCount(1, intelligence.interventions.length, 80),
    });
  }

  if (intelligence.schoolExcellence.participationRatePct < 15) {
    risks.push({
      ar: `معدل المشاركة ${intelligence.schoolExcellence.participationRatePct}% أقل من المستوى المثالي.`,
      en: `Participation rate ${intelligence.schoolExcellence.participationRatePct}% is below the ideal threshold.`,
      confidence: confidenceFromEvidenceCount(2, intelligence.schoolExcellence.totalStudents, 78),
    });
  }

  if (intelligence.longitudinalGrowth.some((point) => point.growthRatePct < 0)) {
    risks.push({
      ar: "يوجد تراجع في النمو الطولي خلال بعض السنوات.",
      en: "Longitudinal growth shows decline in some years.",
      confidence: confidenceFromEvidenceCount(2, intelligence.longitudinalGrowth.length, 74),
    });
  }

  for (const row of intelligence.opportunityMapping.slice(0, 3)) {
    opportunities.push({
      ar: `${row.labelAr}: فجوة مشاركة ${row.gapPct}% — فرصة لتوسيع النطاق.`,
      en: `${row.labelEn}: ${row.gapPct}% participation gap — expansion opportunity.`,
      confidence: row.confidence ?? confidenceFromEvidenceCount(2, row.participantCount, 72),
    });
  }

  if (intelligence.talentDiscovery.length > 0) {
    opportunities.push({
      ar: `${intelligence.talentDiscovery.length} مرشح(مرشحين) للمواهب يمكن توجيههم لبرامج نوعية.`,
      en: `${intelligence.talentDiscovery.length} talent candidate(s) can be routed to specialized programs.`,
      confidence: confidenceFromEvidenceCount(1, intelligence.talentDiscovery.length, 83),
    });
  }

  if (intelligence.departmentExcellence.length > 0) {
    const top = intelligence.departmentExcellence[0];
    opportunities.push({
      ar: `مسار ${top.labelAr} يحقق تميزاً (${top.excellenceIndex}) ويمكن توسيع ممارساته.`,
      en: `${top.labelEn} pathway shows excellence (${top.excellenceIndex}) and can scale its practices.`,
      confidence: confidenceFromEvidenceCount(2, top.studentCount, 79),
    });
  }

  for (const highlight of intelligence.growthTrends.highlights.slice(0, 5)) {
    growthTrends.push({
      ar: highlight.bodyAr,
      en: highlight.bodyEn,
      confidence: highlight.confidence,
    });
  }

  if (intelligence.growthTrends.summaryAr) {
    growthTrends.push({
      ar: intelligence.growthTrends.summaryAr,
      en: intelligence.growthTrends.summaryEn,
      confidence: confidenceFromEvidenceCount(
        intelligence.growthTrends.highlights.length,
        intelligence.longitudinalGrowth.length,
        77
      ),
    });
  }

  if (intelligence.growthTrends.forecastSignalAr) {
    growthTrends.push({
      ar: intelligence.growthTrends.forecastSignalAr,
      en: intelligence.growthTrends.forecastSignalEn,
      confidence: confidenceFromEvidenceCount(1, intelligence.longitudinalGrowth.length, 70),
    });
  }

  if (intelligence.interventions.length > 0) {
    recommendations.push({
      ar: "تفعيل خطط التدخل للطلاب ذوي الأولوية العالية خلال الأسبوعين القادمين.",
      en: "Activate intervention plans for high-priority students within the next two weeks.",
      confidence: confidenceFromEvidenceCount(1, intelligence.interventions.length, 88),
    });
  }

  if (readiness.noDataSections > 0) {
    recommendations.push({
      ar: "تعزيز بيانات النمو والمشاركة لتحسين اكتشاف المواهب تلقائياً.",
      en: "Enrich growth and participation data to improve automatic talent discovery.",
      confidence: confidenceFromEvidenceCount(1, readiness.noDataSections, 75),
    });
  }

  for (const insight of intelligence.strategicInsights.slice(0, 2)) {
    recommendations.push({
      ar: insight.bodyAr,
      en: insight.bodyEn,
      confidence: insight.confidence,
    });
  }

  if (intelligence.opportunityMapping.length > 0) {
    const topGap = intelligence.opportunityMapping[0];
    recommendations.push({
      ar: `استهداف ${topGap.labelAr} لرفع المشاركة بـ ${topGap.gapPct}%.`,
      en: `Target ${topGap.labelEn} to raise participation by ${topGap.gapPct}%.`,
      confidence: topGap.confidence ?? confidenceFromEvidenceCount(2, topGap.participantCount, 81),
    });
  }

  return {
    strengths: limitItems(strengths),
    risks: limitItems(risks),
    opportunities: limitItems(opportunities),
    recommendations: limitItems(recommendations),
    growthTrends: limitItems(growthTrends, 5),
  };
};
