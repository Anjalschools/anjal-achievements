/**
 * Educational equity intelligence — representation, gaps, and balance scores (client layer).
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import { scaleSliceToPerspective } from "@/lib/analytics/analytics-perspective";

export type EquityIndicator = {
  id: string;
  labelAr: string;
  labelEn: string;
  value: number;
  unit: "pct" | "score" | "gap";
  status: "balanced" | "warning" | "critical";
};

export type EquityNarrative = {
  id: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
};

export type EquityIntelligenceBundle = {
  equityScore: number;
  indicators: EquityIndicator[];
  narratives: EquityNarrative[];
};

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const gapPct = (a: number, b: number): number => Math.abs(pct(a, b) - pct(b, a));

const statusFromGap = (gap: number): EquityIndicator["status"] => {
  if (gap <= 8) return "balanced";
  if (gap <= 18) return "warning";
  return "critical";
};

export const buildEquityIntelligence = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective = "participation"
): EquityIntelligenceBundle => {
  const totalP = data.kpis.totalParticipations || 1;
  const male = data.charts.genderParticipation.find((x) => x.key === "male")?.count ?? 0;
  const female = data.charts.genderParticipation.find((x) => x.key === "female")?.count ?? 0;
  const maw = data.charts.mawhibaSplit.find((x) => x.key === "yes")?.count ?? 0;
  const nonMaw = data.charts.mawhibaSplit.find((x) => x.key === "no")?.count ?? 0;
  const ar = data.charts.sectionParticipation.find((x) => x.key === "arabic")?.count ?? 0;
  const intl =
    data.charts.sectionParticipation.find((x) => x.key === "international")?.count ?? 0;

  const maleP = scaleSliceToPerspective(male, data, perspective);
  const femaleP = scaleSliceToPerspective(female, data, perspective);
  const mawP = scaleSliceToPerspective(maw, data, perspective);
  const nonMawP = scaleSliceToPerspective(nonMaw, data, perspective);
  const arP = scaleSliceToPerspective(ar, data, perspective);
  const intlP = scaleSliceToPerspective(intl, data, perspective);

  const genderGap = gapPct(maleP, femaleP);
  const mawhibaGap = gapPct(mawP, nonMawP);
  const sectionGap = gapPct(arP, intlP);
  const participationGap = Math.max(genderGap, mawhibaGap, sectionGap);

  const achievements = data.table.reduce((s, r) => s + r.approvedAchievements, 0);
  const achievementGap =
    totalP > 0 ? Math.abs(pct(achievements, totalP) - 50) : 0;

  const girlsRep = pct(femaleP, maleP + femaleP);
  const boysRep = pct(maleP, maleP + femaleP);
  const mawhibaRep = pct(mawP, mawP + nonMawP);

  const balanceScore = Math.max(
    0,
    Math.round(100 - (participationGap * 1.2 + achievementGap * 0.5 + sectionGap * 0.3))
  );

  const indicators: EquityIndicator[] = [
    {
      id: "girls_representation",
      labelAr: "تمثيل البنات",
      labelEn: "Girls representation",
      value: girlsRep,
      unit: "pct",
      status: statusFromGap(Math.abs(girlsRep - 50)),
    },
    {
      id: "boys_representation",
      labelAr: "تمثيل البنين",
      labelEn: "Boys representation",
      value: boysRep,
      unit: "pct",
      status: statusFromGap(Math.abs(boysRep - 50)),
    },
    {
      id: "mawhiba_representation",
      labelAr: "تمثيل الموهبة",
      labelEn: "Mawhiba representation",
      value: mawhibaRep,
      unit: "pct",
      status: statusFromGap(mawhibaGap),
    },
    {
      id: "section_balance",
      labelAr: "توازن الأقسام",
      labelEn: "Section balance",
      value: 100 - sectionGap,
      unit: "score",
      status: statusFromGap(sectionGap),
    },
    {
      id: "participation_gap",
      labelAr: "فجوة المشاركة",
      labelEn: "Participation gap",
      value: participationGap,
      unit: "gap",
      status: statusFromGap(participationGap),
    },
    {
      id: "achievement_gap",
      labelAr: "فجوة الإنجاز",
      labelEn: "Achievement gap",
      value: achievementGap,
      unit: "gap",
      status: statusFromGap(achievementGap),
    },
  ];

  const narratives: EquityNarrative[] = [];

  if (girlsRep < 42 && maleP + femaleP > 0) {
    narratives.push({
      id: "equity_girls_under",
      priority: 75,
      bodyAr: `تمثيل البنات (${girlsRep}%) أقل من المتوقع في النطاق المفلتر.`,
      bodyEn: `Girls representation (${girlsRep}%) is below expected in the filtered scope.`,
    });
  }

  if (arP > intlP && sectionGap >= 10) {
    narratives.push({
      id: "equity_arabic_density",
      priority: 70,
      bodyAr: `القسم العربي يمتلك أعلى كثافة مشاركة (${arP} مقابل ${intlP}).`,
      bodyEn: `Arabic section has higher participation density (${arP} vs ${intlP}).`,
    });
  }

  if (nonMawP > mawP * 1.4 && mawP + nonMawP > 0) {
    narratives.push({
      id: "equity_non_mawhiba_intl",
      priority: 68,
      bodyAr: `طلاب غير الموهبة أقل تمثيلًا نسبيًا في البرامج الدولية ضمن النطاق.`,
      bodyEn: `Non-Mawhiba students have relatively lower representation in international-style programs.`,
    });
  }

  const kangarooLike = data.table.find((r) => /kangaroo|كانجارو/i.test(r.activityLabelEn + r.activityLabelAr));
  if (kangarooLike && genderGap <= 10) {
    narratives.push({
      id: "equity_kangaroo_balance",
      priority: 62,
      bodyAr: `يوجد توازن مرتفع بين البنين والبنات في ${kangarooLike.activityLabelAr}.`,
      bodyEn: `High gender balance observed in ${kangarooLike.activityLabelEn}.`,
    });
  }

  return {
    equityScore: balanceScore,
    indicators,
    narratives: narratives.sort((a, b) => b.priority - a.priority),
  };
};
