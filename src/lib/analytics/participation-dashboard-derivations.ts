import type { ParticipationActivityRow, ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { computeMedalConversionRate } from "@/lib/analytics/analytics-metrics-definitions";

export type CompetitionIntelRow = {
  key: string;
  labelAr: string;
  labelEn: string;
  participations: number;
  distinctStudents: number;
  gold: number;
  silver: number;
  bronze: number;
  ranks: number;
  sections: { arabic: number; international: number };
  gender: { male: number; female: number };
};

const COMPETITION_DEFS: Array<{
  key: string;
  labelAr: string;
  labelEn: string;
  match: (row: ParticipationActivityRow) => boolean;
}> = [
  {
    key: "bebras",
    labelAr: "بيبراس",
    labelEn: "Bebras",
    match: (r) =>
      /bebras|بيبراس/i.test(r.typeKey) ||
      /bebras|بيبراس/i.test(r.activityLabelEn) ||
      /bebras|بيبراس/i.test(r.activityLabelAr),
  },
  {
    key: "kangaroo",
    labelAr: "كانجارو",
    labelEn: "Kangaroo",
    match: (r) =>
      /kangaroo|كانجارو/i.test(r.typeKey) ||
      /kangaroo|كانجارو/i.test(r.activityLabelEn) ||
      /kangaroo|كانجارو/i.test(r.activityLabelAr),
  },
  {
    key: "mawhiba",
    labelAr: "موهبة",
    labelEn: "Mawhiba",
    match: (r) =>
      /mawhiba|موهبة|gifted/i.test(r.typeKey) ||
      /mawhiba|موهبة|gifted/i.test(r.activityLabelEn) ||
      /mawhiba|موهبة|gifted/i.test(r.activityLabelAr),
  },
  {
    key: "kaust",
    labelAr: "كاوست",
    labelEn: "KAUST",
    match: (r) =>
      /kaust|كاوست/i.test(r.typeKey) ||
      /kaust|كاوست/i.test(r.activityLabelEn) ||
      /kaust|كاوست/i.test(r.activityLabelAr),
  },
  {
    key: "sat",
    labelAr: "SAT",
    labelEn: "SAT",
    match: (r) => r.typeKey === "sat" || /\bsat\b/i.test(r.activityLabelEn) || /سات/i.test(r.activityLabelAr),
  },
  {
    key: "ielts",
    labelAr: "IELTS",
    labelEn: "IELTS",
    match: (r) => r.typeKey === "ielts" || /\bielts\b/i.test(r.activityLabelEn) || /آيلتس/i.test(r.activityLabelAr),
  },
];

export const deriveCompetitionComparison = (table: ParticipationActivityRow[]): CompetitionIntelRow[] =>
  COMPETITION_DEFS.map((def) => {
    const rows = table.filter(def.match);
    return {
      key: def.key,
      labelAr: def.labelAr,
      labelEn: def.labelEn,
      participations: rows.reduce((s, r) => s + r.totalParticipations, 0),
      distinctStudents: rows.reduce((s, r) => s + r.distinctParticipants, 0),
      gold: rows.reduce((s, r) => s + r.goldMedalCount, 0),
      silver: rows.reduce((s, r) => s + r.silverMedalCount, 0),
      bronze: rows.reduce((s, r) => s + r.bronzeMedalCount, 0),
      ranks: rows.reduce((s, r) => s + r.rankCount, 0),
      sections: {
        arabic: rows.reduce((s, r) => s + r.arabicParticipants, 0),
        international: rows.reduce((s, r) => s + r.internationalParticipants, 0),
      },
      gender: {
        male: rows.reduce((s, r) => s + r.maleParticipants, 0),
        female: rows.reduce((s, r) => s + r.femaleParticipants, 0),
      },
    };
  });

export type SectionIntelRow = {
  key: string;
  labelAr: string;
  labelEn: string;
  participations: number;
  medals: number;
  gold: number;
  excellenceAvg: number;
};

export const deriveSectionIntelligence = (table: ParticipationActivityRow[]): SectionIntelRow[] => {
  const arabic = table.reduce(
    (acc, r) => ({
      participations: acc.participations + r.arabicParticipants,
      medals: acc.medals + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount,
      gold: acc.gold + r.goldMedalCount,
      excellenceSum: acc.excellenceSum + r.excellenceRatePct * r.totalParticipations,
      weight: acc.weight + r.totalParticipations,
    }),
    { participations: 0, medals: 0, gold: 0, excellenceSum: 0, weight: 0 }
  );
  const intl = table.reduce(
    (acc, r) => ({
      participations: acc.participations + r.internationalParticipants,
      medals: acc.medals + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount,
      gold: acc.gold + r.goldMedalCount,
      excellenceSum: acc.excellenceSum + r.excellenceRatePct * r.totalParticipations,
      weight: acc.weight + r.totalParticipations,
    }),
    { participations: 0, medals: 0, gold: 0, excellenceSum: 0, weight: 0 }
  );
  const mawhiba = table.reduce(
    (acc, r) => ({
      participations: acc.participations + r.mawhibaParticipants,
      medals: acc.medals + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount,
      gold: acc.gold + r.goldMedalCount,
      excellenceSum: acc.excellenceSum + r.excellenceRatePct * r.totalParticipations,
      weight: acc.weight + r.totalParticipations,
    }),
    { participations: 0, medals: 0, gold: 0, excellenceSum: 0, weight: 0 }
  );
  return [
    {
      key: "arabic",
      labelAr: "القسم العربي",
      labelEn: "Arabic section",
      participations: arabic.participations,
      medals: arabic.medals,
      gold: arabic.gold,
      excellenceAvg: arabic.weight > 0 ? Math.round((arabic.excellenceSum / arabic.weight) * 10) / 10 : 0,
    },
    {
      key: "international",
      labelAr: "القسم الدولي",
      labelEn: "International section",
      participations: intl.participations,
      medals: intl.medals,
      gold: intl.gold,
      excellenceAvg: intl.weight > 0 ? Math.round((intl.excellenceSum / intl.weight) * 10) / 10 : 0,
    },
    {
      key: "mawhiba",
      labelAr: "فصول موهبة",
      labelEn: "Mawhiba cohort",
      participations: mawhiba.participations,
      medals: mawhiba.medals,
      gold: mawhiba.gold,
      excellenceAvg: mawhiba.weight > 0 ? Math.round((mawhiba.excellenceSum / mawhiba.weight) * 10) / 10 : 0,
    },
  ];
};

export const outcomeCount = (data: ParticipationAnalyticsPayload, key: string): number =>
  data.charts.resultOutcomeCompare.find((x) => x.key === key)?.count ?? 0;

export const topYearFromTrend = (data: ParticipationAnalyticsPayload): { year: number; rows: number } | null => {
  if (!data.charts.yearTrend.length) return null;
  const best = [...data.charts.yearTrend].sort((a, b) => b.totalRows - a.totalRows)[0];
  return best ? { year: best.year, rows: best.totalRows } : null;
};

/** @deprecated use computeMedalConversionRate — kept for backward compatibility */
export const medalConversionRate = (data: ParticipationAnalyticsPayload): number =>
  computeMedalConversionRate(data);

export const derivePerformanceLeaders = (table: ParticipationActivityRow[]) => {
  const byMedals = [...table].sort(
    (a, b) =>
      b.goldMedalCount +
      b.silverMedalCount +
      b.bronzeMedalCount -
      (a.goldMedalCount + a.silverMedalCount + a.bronzeMedalCount)
  );
  const byStudents = [...table].sort((a, b) => b.distinctParticipants - a.distinctParticipants);
  const byExcellence = [...table].sort((a, b) => b.excellenceRatePct - a.excellenceRatePct);
  const medalDensity = [...table]
    .map((r) => ({
      row: r,
      density:
        r.totalParticipations > 0
          ? ((r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount) / r.totalParticipations) * 100
          : 0,
    }))
    .sort((a, b) => b.density - a.density);
  return {
    topCompetitions: byMedals.slice(0, 5),
    topActivities: byStudents.slice(0, 5),
    topExcellence: byExcellence.slice(0, 5),
    topMedalDensity: medalDensity.slice(0, 5),
  };
};

export const deriveStdTestRows = (table: ParticipationActivityRow[]) =>
  table.filter(
    (r) =>
      r.typeKey === "sat" ||
      r.typeKey === "ielts" ||
      r.typeKey === "qudrat" ||
      r.typeKey === "standardized_tests" ||
      /\bsat\b|\bielts\b|qudrat|قدرات|تحصيل/i.test(r.activityLabelEn) ||
      /سات|آيلتس|قدرات|تحصيل/i.test(r.activityLabelAr)
  );
