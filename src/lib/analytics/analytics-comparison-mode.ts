/**
 * Comparative educational intelligence — client-side interpretation from a single payload.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import { scaleSliceToPerspective } from "@/lib/analytics/analytics-perspective";

export type ComparisonKind =
  | "section"
  | "year"
  | "gender"
  | "mawhiba"
  | "grade"
  | "activity"
  | "competition";

export type ComparisonSide = {
  key: string;
  labelAr: string;
  labelEn: string;
  participations: number;
  students: number;
  medals: number;
  conversionPct: number;
  density: number;
  representationPct: number;
};

export type ComparisonDelta = {
  key: "participation" | "medal" | "conversion" | "density" | "growth" | "representation";
  labelAr: string;
  labelEn: string;
  valueA: number;
  valueB: number;
  delta: number;
  deltaPct: number;
  winner: "A" | "B" | "tie";
};

export type ComparisonNarrative = {
  id: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
};

export type ComparisonWorkspaceBundle = {
  kind: ComparisonKind;
  sideA: ComparisonSide;
  sideB: ComparisonSide;
  deltas: ComparisonDelta[];
  narratives: ComparisonNarrative[];
};

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const deltaOf = (a: number, b: number): number => Math.round((a - b) * 100) / 100;

const buildSide = (
  key: string,
  labelAr: string,
  labelEn: string,
  participations: number,
  students: number,
  medals: number,
  totalScope: number
): ComparisonSide => ({
  key,
  labelAr,
  labelEn,
  participations,
  students,
  medals,
  conversionPct: pct(medals, participations),
  density: students > 0 ? Math.round((participations / students) * 100) / 100 : 0,
  representationPct: pct(participations, totalScope),
});

const deltaRow = (
  key: ComparisonDelta["key"],
  labelAr: string,
  labelEn: string,
  valueA: number,
  valueB: number
): ComparisonDelta => {
  const delta = deltaOf(valueA, valueB);
  const base = Math.max(Math.abs(valueA), Math.abs(valueB), 1);
  const deltaPct = Math.round((delta / base) * 1000) / 10;
  let winner: ComparisonDelta["winner"] = "tie";
  if (Math.abs(delta) > 0.01) winner = delta > 0 ? "A" : "B";
  return { key, labelAr, labelEn, valueA, valueB, delta, deltaPct, winner };
};

export const COMPARISON_KIND_OPTIONS: Array<{
  kind: ComparisonKind;
  labelAr: string;
  labelEn: string;
}> = [
  { kind: "section", labelAr: "عربي / دولي", labelEn: "Arabic / International" },
  { kind: "gender", labelAr: "بنين / بنات", labelEn: "Boys / Girls" },
  { kind: "mawhiba", labelAr: "موهبة / غير موهبة", labelEn: "Mawhiba / Non-Mawhiba" },
  { kind: "year", labelAr: "مقارنة سنتين", labelEn: "Year comparison" },
  { kind: "grade", labelAr: "مقارنة صفين", labelEn: "Grade band comparison" },
  { kind: "activity", labelAr: "مقارنة نشاطين", labelEn: "Activity comparison" },
  { kind: "competition", labelAr: "مقارنة مسابقات", labelEn: "Competition comparison" },
];

export const buildComparisonWorkspace = (
  data: ParticipationAnalyticsPayload,
  kind: ComparisonKind,
  perspective: AnalyticsCountPerspective = "participation"
): ComparisonWorkspaceBundle | null => {
  const totalP = data.kpis.totalParticipations || 1;
  const totalStudents = data.kpis.distinctStudents || 1;
  let sideA: ComparisonSide | null = null;
  let sideB: ComparisonSide | null = null;

  if (kind === "section") {
    const ar = data.charts.sectionParticipation.find((x) => x.key === "arabic" || /عربي|arabic/i.test(x.labelEn));
    const intl = data.charts.sectionParticipation.find(
      (x) => x.key === "international" || /دولي|intl/i.test(x.labelEn)
    );
    if (!ar || !intl) return null;
    const pA = scaleSliceToPerspective(ar.count, data, perspective);
    const pB = scaleSliceToPerspective(intl.count, data, perspective);
    sideA = buildSide(ar.key, ar.labelAr, ar.labelEn, pA, Math.round((pA / totalP) * totalStudents), 0, totalP);
    sideB = buildSide(intl.key, intl.labelAr, intl.labelEn, pB, Math.round((pB / totalP) * totalStudents), 0, totalP);
  } else if (kind === "gender") {
    const m = data.charts.genderParticipation.find((x) => x.key === "male");
    const f = data.charts.genderParticipation.find((x) => x.key === "female");
    if (!m || !f) return null;
    const pA = scaleSliceToPerspective(m.count, data, perspective);
    const pB = scaleSliceToPerspective(f.count, data, perspective);
    const mStack = data.charts.genderResultStack.find((x) => x.gender === "male");
    const fStack = data.charts.genderResultStack.find((x) => x.gender === "female");
    const medA = mStack ? mStack.gold + mStack.silver + mStack.bronze : 0;
    const medB = fStack ? fStack.gold + fStack.silver + fStack.bronze : 0;
    sideA = buildSide(m.key, m.labelAr, m.labelEn, pA, Math.round((pA / totalP) * totalStudents), medA, totalP);
    sideB = buildSide(f.key, f.labelAr, f.labelEn, pB, Math.round((pB / totalP) * totalStudents), medB, totalP);
  } else if (kind === "mawhiba") {
    const yes = data.charts.mawhibaSplit.find((x) => x.key === "yes");
    const no = data.charts.mawhibaSplit.find((x) => x.key === "no");
    if (!yes || !no) return null;
    const pA = scaleSliceToPerspective(yes.count, data, perspective);
    const pB = scaleSliceToPerspective(no.count, data, perspective);
    sideA = buildSide(yes.key, yes.labelAr, yes.labelEn, pA, Math.round((pA / totalP) * totalStudents), 0, totalP);
    sideB = buildSide(no.key, no.labelAr, no.labelEn, pB, Math.round((pB / totalP) * totalStudents), 0, totalP);
  } else if (kind === "year") {
    const sorted = [...data.charts.yearTrend].sort((a, b) => a.year - b.year);
    if (sorted.length < 2) return null;
    const a = sorted[sorted.length - 2]!;
    const b = sorted[sorted.length - 1]!;
    sideA = buildSide(String(a.year), String(a.year), String(a.year), a.totalRows, a.distinctStudents, a.goldMedals, totalP);
    sideB = buildSide(String(b.year), String(b.year), String(b.year), b.totalRows, b.distinctStudents, b.goldMedals, totalP);
  } else if (kind === "grade") {
    const sorted = [...data.charts.levelDistribution].sort((a, b) => b.count - a.count);
    if (sorted.length < 2) return null;
    const a = sorted[0]!;
    const b = sorted[1]!;
    const kA = a.labelEn || a.labelAr;
    const kB = b.labelEn || b.labelAr;
    sideA = buildSide(kA, a.labelAr, a.labelEn, a.count, Math.round((a.count / totalP) * totalStudents), 0, totalP);
    sideB = buildSide(kB, b.labelAr, b.labelEn, b.count, Math.round((b.count / totalP) * totalStudents), 0, totalP);
  } else if (kind === "activity" || kind === "competition") {
    const sorted = [...data.table].sort((a, b) => b.totalParticipations - a.totalParticipations);
    if (sorted.length < 2) return null;
    const a = sorted[0]!;
    const b = sorted[1]!;
    const medA = a.goldMedalCount + a.silverMedalCount + a.bronzeMedalCount;
    const medB = b.goldMedalCount + b.silverMedalCount + b.bronzeMedalCount;
    sideA = buildSide(
      a.activityKey,
      a.activityLabelAr,
      a.activityLabelEn,
      a.totalParticipations,
      a.distinctParticipants,
      medA,
      totalP
    );
    sideB = buildSide(
      b.activityKey,
      b.activityLabelAr,
      b.activityLabelEn,
      b.totalParticipations,
      b.distinctParticipants,
      medB,
      totalP
    );
  }

  if (!sideA || !sideB) return null;

  const deltas: ComparisonDelta[] = [
    deltaRow("participation", "فرق المشاركات", "Participation delta", sideA.participations, sideB.participations),
    deltaRow("medal", "فرق الميداليات", "Medal delta", sideA.medals, sideB.medals),
    deltaRow("conversion", "فرق التحويل", "Conversion delta", sideA.conversionPct, sideB.conversionPct),
    deltaRow("density", "فرق الكثافة", "Density delta", sideA.density, sideB.density),
    deltaRow("representation", "فرق التمثيل", "Representation delta", sideA.representationPct, sideB.representationPct),
  ];

  if (kind === "year") {
    deltas.push(
      deltaRow("growth", "فرق النمو", "Growth delta", sideB.participations, sideA.participations)
    );
  }

  const narratives: ComparisonNarrative[] = [];
  const leadA = sideA.participations > sideB.participations;
  const leadLabelAr = leadA ? sideA.labelAr : sideB.labelAr;
  const leadLabelEn = leadA ? sideA.labelEn : sideB.labelEn;
  const trailLabelAr = leadA ? sideB.labelAr : sideA.labelAr;
  const trailLabelEn = leadA ? sideB.labelEn : sideA.labelEn;
  const partDelta = Math.abs(deltas[0]!.delta);
  const partPct = deltas[0]!.deltaPct;

  if (perspective === "student") {
    narratives.push({
      id: "comparison_students_lead",
      priority: 80,
      bodyAr: `طلاب ${leadLabelAr} يقودون المشاركة (${sideA.students} مقابل ${sideB.students} طالب).`,
      bodyEn: `${leadLabelEn} students lead participation (${sideA.students} vs ${sideB.students}).`,
    });
  } else {
    narratives.push({
      id: "comparison_participation_lead",
      priority: 78,
      bodyAr: `${leadLabelAr} يمتلك أعلى كثافة مشاركات (${partDelta} فرق · ${partPct}%).`,
      bodyEn: `${leadLabelEn} has higher participation density (${partDelta} delta · ${partPct}%).`,
    });
  }

  const convDelta = deltas[2]!;
  if (convDelta.winner !== "tie") {
    const convLead = convDelta.winner === "A" ? sideA : sideB;
    const convTrail = convDelta.winner === "A" ? sideB : sideA;
    narratives.push({
      id: "comparison_conversion",
      priority: 72,
      bodyAr: `${convLead.labelAr} يحقق معدل تحويل ${convLead.conversionPct}% مقابل ${convTrail.conversionPct}% لـ ${convTrail.labelAr}.`,
      bodyEn: `${convLead.labelEn} achieves ${convLead.conversionPct}% conversion vs ${convTrail.conversionPct}% for ${convTrail.labelEn}.`,
    });
  }

  if (kind === "section" && partPct >= 15) {
    narratives.push({
      id: "comparison_section_sat",
      priority: 68,
      bodyAr: `${leadLabelAr} يتفوق في النطاق الحالي بنسبة ${partPct}% — راقب SAT/IELTS في القسم الدولي.`,
      bodyEn: `${leadLabelEn} leads the current scope by ${partPct}% — review SAT/IELTS in the international cohort.`,
    });
  }

  if (kind === "grade") {
    narratives.push({
      id: "comparison_grade_activity",
      priority: 66,
      bodyAr: `${leadLabelAr} أكثر نشاطًا من ${trailLabelAr} ضمن الفلاتر الحالية.`,
      bodyEn: `${leadLabelEn} is more active than ${trailLabelEn} under current filters.`,
    });
  }

  return { kind, sideA, sideB, deltas, narratives: narratives.sort((a, b) => b.priority - a.priority) };
};

export const memoComparisonKey = (
  filterHash: string,
  kind: ComparisonKind,
  perspective: AnalyticsCountPerspective
): string => `cmp:${filterHash}:${kind}:${perspective}`;

export const formatDeltaIndicator = (
  delta: number,
  loc: AnalyticsLocale
): { text: string; tone: "gain" | "loss" | "neutral" } => {
  if (Math.abs(delta) < 0.01) {
    return { text: loc === "ar" ? "≈0" : "≈0", tone: "neutral" };
  }
  const sign = delta > 0 ? "+" : "";
  return {
    text: `${sign}${delta}`,
    tone: delta > 0 ? "gain" : "loss",
  };
};

export const comparisonPerspectiveMetric = (
  side: ComparisonSide,
  perspective: AnalyticsCountPerspective
): number => {
  switch (perspective) {
    case "student":
      return side.students;
    case "result":
      return side.medals;
    default:
      return side.participations;
  }
};
