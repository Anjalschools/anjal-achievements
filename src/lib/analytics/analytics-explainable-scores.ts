/**
 * Explainable governance scores — equity, opportunity, recommendation breakdowns.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import { buildEquityIntelligence } from "@/lib/analytics/analytics-equity-intelligence";
import {
  buildOpportunityIntelligence,
  computeOpportunityScore,
} from "@/lib/analytics/analytics-opportunity-intelligence";
import {
  buildEducationalRecommendations,
  computeRecommendationScore,
} from "@/lib/analytics/analytics-recommendation-engine";
import { normalizeDecimal, ratioToPercentage } from "@/lib/analytics/analytics-number-formatting";

export type ScoreFactor = {
  id: string;
  labelAr: string;
  labelEn: string;
  weightPct: number;
  contribution: number;
  rawValue: number;
  impact: "positive" | "negative" | "neutral";
  explanationAr: string;
  explanationEn: string;
};

export type ExplainableScoreBundle = {
  score: number;
  factors: ScoreFactor[];
  improvementAr: string[];
  improvementEn: string[];
};

const pctGap = (a: number, b: number): number =>
  Math.abs(ratioToPercentage(a, a + b) - 50);

export const buildEquityScoreExplanation = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective = "participation"
): ExplainableScoreBundle => {
  const bundle = buildEquityIntelligence(data, perspective);
  const male = data.charts.genderParticipation.find((x) => x.key === "male")?.count ?? 0;
  const female = data.charts.genderParticipation.find((x) => x.key === "female")?.count ?? 0;
  const maw = data.charts.mawhibaSplit.find((x) => x.key === "yes")?.count ?? 0;
  const nonMaw = data.charts.mawhibaSplit.find((x) => x.key === "no")?.count ?? 0;
  const ar = data.charts.sectionParticipation.find((x) => x.key === "arabic")?.count ?? 0;
  const intl = data.charts.sectionParticipation.find((x) => x.key === "international")?.count ?? 0;

  const genderGap = pctGap(male, female);
  const mawhibaGap = pctGap(maw, nonMaw);
  const sectionGap = pctGap(ar, intl);
  const participationGap = Math.max(genderGap, mawhibaGap, sectionGap);

  const achievements = data.table.reduce((s, r) => s + r.approvedAchievements, 0);
  const totalP = data.kpis.totalParticipations || 1;
  const achievementGap = Math.abs(ratioToPercentage(achievements, totalP) - 50);

  const factors: ScoreFactor[] = [
    {
      id: "participation_balance",
      labelAr: "توازن المشاركة",
      labelEn: "Participation balance",
      weightPct: 40,
      rawValue: participationGap,
      contribution: normalizeDecimal(participationGap * 1.2, 1),
      impact: participationGap > 15 ? "negative" : "positive",
      explanationAr: `أقصى فجوة مشاركة ${participationGap}% بين الفئات الديموغرافية`,
      explanationEn: `Max participation gap ${participationGap}% across demographic cohorts`,
    },
    {
      id: "achievement_balance",
      labelAr: "توازن الإنجاز",
      labelEn: "Achievement balance",
      weightPct: 25,
      rawValue: achievementGap,
      contribution: normalizeDecimal(achievementGap * 0.5, 1),
      impact: achievementGap > 20 ? "negative" : "neutral",
      explanationAr: "مقارنة نسبة الإنجازات المعتمدة بالمشاركات",
      explanationEn: "Approved achievements vs participations ratio",
    },
    {
      id: "section_balance",
      labelAr: "توازن الأقسام",
      labelEn: "Section balance",
      weightPct: 20,
      rawValue: sectionGap,
      contribution: normalizeDecimal(sectionGap * 0.3, 1),
      impact: sectionGap > 12 ? "negative" : "positive",
      explanationAr: "الفجوة بين القسم العربي والدولي",
      explanationEn: "Arabic vs international section gap",
    },
    {
      id: "representation",
      labelAr: "تمثيل الفئات",
      labelEn: "Cohort representation",
      weightPct: 15,
      rawValue: Math.max(genderGap, mawhibaGap),
      contribution: normalizeDecimal(Math.max(0, 15 - Math.max(genderGap, mawhibaGap) * 0.2), 1),
      impact: genderGap > 18 ? "negative" : "positive",
      explanationAr: "تمثيل البنين/البنات والموهبة/غير الموهبة",
      explanationEn: "Gender and Mawhiba representation spread",
    },
  ];

  const improvementAr: string[] = [];
  const improvementEn: string[] = [];
  if (genderGap > 12) {
    improvementAr.push("تقليل فجوة المشاركة بين البنين والبنات");
    improvementEn.push("Reduce gender participation gap");
  }
  if (sectionGap > 12) {
    improvementAr.push("موازنة المشاركة بين القسم العربي والدولي");
    improvementEn.push("Balance Arabic and international section participation");
  }
  if (mawhibaGap > 15) {
    improvementAr.push("توسيع فرص غير الموهبة في البرامج العلمية");
    improvementEn.push("Expand non-Mawhiba access to science programs");
  }

  return {
    score: bundle.equityScore,
    factors,
    improvementAr,
    improvementEn,
  };
};

export const buildOpportunityScoreExplanation = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective = "participation"
): ExplainableScoreBundle => {
  const { score } = computeOpportunityScore(data, perspective);
  const equity = buildEquityIntelligence(data, perspective);
  const opp = buildOpportunityIntelligence(data, perspective);
  const maxGap = opp.gaps.reduce((m, g) => Math.max(m, g.gapValue), 0);
  const maxConc = opp.concentrations[0]?.dominantPct ?? 0;
  const activitySpread =
    data.table.filter((r) => r.totalParticipations > 0).length /
    Math.max(1, data.table.length);
  const diversitySpread = Math.min(100, Math.round(activitySpread * 40 + opp.spread.levelCount * 8));

  const factors: ScoreFactor[] = [
    {
      id: "participation_spread",
      labelAr: "انتشار المشاركة",
      labelEn: "Participation spread",
      weightPct: 20,
      rawValue: opp.spread.participationSpread,
      contribution: normalizeDecimal(opp.spread.participationSpread * 0.2, 1),
      impact: opp.spread.participationSpread < 40 ? "negative" : "positive",
      explanationAr: "تنوع الصفوف والأنشطة النشطة",
      explanationEn: "Active grades and activities diversity",
    },
    {
      id: "representation_balance",
      labelAr: "توازن التمثيل",
      labelEn: "Representation balance",
      weightPct: 15,
      rawValue: maxGap,
      contribution: normalizeDecimal((100 - maxGap) * 0.15, 1),
      impact: maxGap > 20 ? "negative" : "positive",
      explanationAr: "أكبر فجوة تمثيل أو وصول",
      explanationEn: "Largest representation or access gap",
    },
    {
      id: "activity_diversity",
      labelAr: "تنوع الأنشطة",
      labelEn: "Activity diversity",
      weightPct: 30,
      rawValue: diversitySpread,
      contribution: normalizeDecimal(diversitySpread * 0.2, 1),
      impact: diversitySpread < 50 ? "negative" : "positive",
      explanationAr: `${opp.spread.activityCount} نشاط نشط · ${opp.spread.levelCount} مستوى`,
      explanationEn: `${opp.spread.activityCount} active activities · ${opp.spread.levelCount} levels`,
    },
    {
      id: "equity_contribution",
      labelAr: "مساهمة العدالة",
      labelEn: "Equity contribution",
      weightPct: 35,
      rawValue: equity.equityScore,
      contribution: normalizeDecimal(equity.equityScore * 0.35, 1),
      impact: equity.equityScore < 60 ? "negative" : "positive",
      explanationAr: "مؤشر العدالة التعليمية المدمج",
      explanationEn: "Integrated educational equity score",
    },
  ];

  const improvementAr: string[] = [];
  const improvementEn: string[] = [];
  if (maxConc > 35) {
    improvementAr.push("تقليل تركز المشاركات في نشاط واحد");
    improvementEn.push("Reduce single-activity concentration");
  }
  if (maxGap > 18) {
    improvementAr.push("معالجة فجوات الوصول والتمثيل");
    improvementEn.push("Address access and representation gaps");
  }

  return { score, factors, improvementAr, improvementEn };
};

export const buildRecommendationScoreExplanation = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective = "participation"
): ExplainableScoreBundle => {
  const bundle = buildEducationalRecommendations(data, perspective);
  const score = computeRecommendationScore(bundle.recommendations);
  const critical = bundle.recommendations.filter((r) => r.severity === "critical").length;
  const high = bundle.recommendations.filter((r) => r.severity === "high").length;
  const avgImpact =
    bundle.recommendations.length > 0
      ? bundle.recommendations.reduce((s, r) => s + (r.opportunityImpact + r.equityImpact) / 2, 0) /
        bundle.recommendations.length
      : 0;

  const factors: ScoreFactor[] = [
    {
      id: "gap_volume",
      labelAr: "حجم الفجوات",
      labelEn: "Gap volume",
      weightPct: 30,
      rawValue: bundle.recommendations.length,
      contribution: normalizeDecimal(Math.min(100, bundle.recommendations.length * 8), 1),
      impact: bundle.recommendations.length > 8 ? "negative" : "neutral",
      explanationAr: `${bundle.recommendations.length} توصية نشطة`,
      explanationEn: `${bundle.recommendations.length} active recommendations`,
    },
    {
      id: "severity",
      labelAr: "خطورة التفاوت",
      labelEn: "Severity load",
      weightPct: 25,
      rawValue: critical + high,
      contribution: normalizeDecimal((critical * 15 + high * 8), 1),
      impact: critical > 0 ? "negative" : "neutral",
      explanationAr: `${critical} حرجة · ${high} مرتفعة`,
      explanationEn: `${critical} critical · ${high} high`,
    },
    {
      id: "participation_impact",
      labelAr: "أثر المشاركة",
      labelEn: "Participation impact",
      weightPct: 25,
      rawValue: avgImpact,
      contribution: normalizeDecimal(avgImpact * 0.85, 1),
      impact: avgImpact > 60 ? "negative" : "positive",
      explanationAr: "متوسط أثر الفرص والعدالة",
      explanationEn: "Average opportunity and equity impact",
    },
    {
      id: "improvement_potential",
      labelAr: "فرص التحسين",
      labelEn: "Improvement potential",
      weightPct: 20,
      rawValue: 100 - score,
      contribution: normalizeDecimal((100 - score) * 0.2, 1),
      impact: score < 70 ? "negative" : "positive",
      explanationAr: "مجال رفع المشاركة والتنوع",
      explanationEn: "Room to raise participation and diversity",
    },
  ];

  return {
    score,
    factors,
    improvementAr: [
      critical > 0 ? "معالجة التوصيات الحرجة أولاً" : "الحفاظ على التوازن الحالي",
    ],
    improvementEn: [
      critical > 0 ? "Address critical recommendations first" : "Maintain current balance",
    ],
  };
};
