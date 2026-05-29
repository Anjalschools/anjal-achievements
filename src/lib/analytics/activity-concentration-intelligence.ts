/**
 * Activity concentration intelligence — detects demographic/section dominance per activity.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

export type ConcentrationDominanceKind = "section" | "gender" | "mawhiba";

export type ActivityConcentrationRow = {
  activityKey: string;
  labelAr: string;
  labelEn: string;
  participations: number;
  concentrationRatio: number;
  dominantKind: ConcentrationDominanceKind;
  dominantLabelAr: string;
  dominantLabelEn: string;
  dominantPct: number;
  narrativeAr: string;
  narrativeEn: string;
  recommendationAr: string;
  recommendationEn: string;
};

const pct = (a: number, total: number): number =>
  total > 0 ? Math.round((a / total) * 1000) / 10 : 0;

const dominanceFromRow = (
  r: ParticipationActivityRow
): {
  kind: ConcentrationDominanceKind;
  labelAr: string;
  labelEn: string;
  count: number;
  pct: number;
} | null => {
  const total = r.totalParticipations;
  if (total <= 0) return null;

  const sectionPairs: Array<[number, string, string, ConcentrationDominanceKind]> = [
    [r.arabicParticipants, "عربي", "Arabic", "section"],
    [r.internationalParticipants, "دولي", "International", "section"],
  ];
  const genderPairs: Array<[number, string, string, ConcentrationDominanceKind]> = [
    [r.maleParticipants, "بنين", "Boys", "gender"],
    [r.femaleParticipants, "بنات", "Girls", "gender"],
  ];
  const mawPairs: Array<[number, string, string, ConcentrationDominanceKind]> = [
    [r.mawhibaParticipants, "موهبة", "Mawhiba", "mawhiba"],
    [r.nonMawhibaParticipants, "غير موهبة", "Non-Mawhiba", "mawhiba"],
  ];

  const all = [...sectionPairs, ...genderPairs, ...mawPairs].sort((a, b) => b[0] - a[0]);
  const best = all[0];
  if (!best || best[0] <= 0) return null;
  return {
    kind: best[3],
    labelAr: best[1],
    labelEn: best[2],
    count: best[0],
    pct: pct(best[0], total),
  };
};

export const buildActivityConcentrationIntelligence = (
  table: ParticipationActivityRow[],
  limit = 8
): ActivityConcentrationRow[] => {
  const rows = [...table]
    .filter((r) => r.totalParticipations > 0)
    .map((r) => {
      const dom = dominanceFromRow(r);
      if (!dom) return null;
      const concentrationRatio = dom.pct / 100;
      return {
        activityKey: r.activityKey,
        labelAr: r.activityLabelAr,
        labelEn: r.activityLabelEn,
        participations: r.totalParticipations,
        concentrationRatio,
        dominantKind: dom.kind,
        dominantLabelAr: dom.labelAr,
        dominantLabelEn: dom.labelEn,
        dominantPct: dom.pct,
        narrativeAr: buildConcentrationNarrativeAr(r, dom),
        narrativeEn: buildConcentrationNarrativeEn(r, dom),
        recommendationAr: buildConcentrationRecommendationAr(r, dom),
        recommendationEn: buildConcentrationRecommendationEn(r, dom),
      };
    })
    .filter((x): x is ActivityConcentrationRow => x !== null)
    .sort((a, b) => b.dominantPct - a.dominantPct);

  return rows.slice(0, limit);
};

const isOlympiad = (r: ParticipationActivityRow): boolean =>
  /olympiad|أولمبياد|bebras|بيبراس|mawhiba|موهبة/i.test(r.activityLabelEn + r.activityLabelAr);

const isSat = (r: ParticipationActivityRow): boolean =>
  /sat|ielts|قدرات|تحصيلي/i.test(r.activityLabelEn + r.activityLabelAr);

const buildConcentrationNarrativeAr = (
  r: ParticipationActivityRow,
  dom: NonNullable<ReturnType<typeof dominanceFromRow>>
): string => {
  if (isOlympiad(r) && dom.kind === "mawhiba" && dom.pct >= 60) {
    return `الأولمبيادات تتركز بشكل كبير داخل طلاب ${dom.labelAr} (${dom.pct}%).`;
  }
  if (isSat(r) && dom.labelEn === "International" && dom.pct >= 55) {
    return `مشاركات SAT/اختبارات معيارية مقتصرة تقريبًا على القسم الدولي (${dom.pct}%).`;
  }
  if (dom.kind === "gender" && dom.pct >= 65) {
    return `${r.activityLabelAr}: ${dom.labelAr} يمثلون غالبية المشاركات (${dom.pct}%).`;
  }
  if (dom.kind === "section" && dom.labelEn === "Arabic" && dom.pct >= 70) {
    return `القسم العربي منخفض التمثيل في البرامج الدولية — ${r.activityLabelAr} يتركز في ${dom.labelAr} (${dom.pct}%).`;
  }
  return `${r.activityLabelAr} يتركز بنسبة ${dom.pct}% داخل ${dom.labelAr}.`;
};

const buildConcentrationNarrativeEn = (
  r: ParticipationActivityRow,
  dom: NonNullable<ReturnType<typeof dominanceFromRow>>
): string => {
  if (isOlympiad(r) && dom.kind === "mawhiba" && dom.pct >= 60) {
    return `Olympiad-style activities concentrate heavily in ${dom.labelEn} students (${dom.pct}%).`;
  }
  if (isSat(r) && dom.labelEn === "International" && dom.pct >= 55) {
    return `SAT/standardized tests are largely limited to the international section (${dom.pct}%).`;
  }
  if (dom.kind === "gender" && dom.pct >= 65) {
    return `${r.activityLabelEn}: ${dom.labelEn} represent the majority of participations (${dom.pct}%).`;
  }
  return `${r.activityLabelEn} is ${dom.pct}% concentrated in ${dom.labelEn}.`;
};

const buildConcentrationRecommendationAr = (
  r: ParticipationActivityRow,
  dom: NonNullable<ReturnType<typeof dominanceFromRow>>
): string => {
  if (isOlympiad(r) && dom.kind === "mawhiba") {
    return "يوصى بتوسيع برامج الأولمبياد للمرحلة المتوسطة وغير الموهبة.";
  }
  if (isSat(r)) {
    return "يحتاج القسم الدولي إلى تعزيز المشاركة العلمية المتنوعة.";
  }
  if (dom.kind === "mawhiba") {
    return "تمثيل غير الموهبة منخفض في المسابقات التقنية — وسّع الوصول.";
  }
  if (dom.kind === "section" && dom.labelEn === "International") {
    return "عزّز مشاركة القسم العربي في البرامج الدولية.";
  }
  return `وسّع الوصول لـ ${r.activityLabelAr} خارج فئة ${dom.labelAr}.`;
};

const buildConcentrationRecommendationEn = (
  r: ParticipationActivityRow,
  dom: NonNullable<ReturnType<typeof dominanceFromRow>>
): string => {
  if (isOlympiad(r) && dom.kind === "mawhiba") {
    return "Expand olympiad programs to middle school and non-Mawhiba cohorts.";
  }
  if (isSat(r)) {
    return "International section needs broader scientific participation diversity.";
  }
  if (dom.kind === "mawhiba") {
    return "Non-Mawhiba representation is low in technical competitions — broaden access.";
  }
  return `Broaden access to ${r.activityLabelEn} beyond the ${dom.labelEn} cohort.`;
};
