/**
 * Multi-dimensional demographic & competition intelligence — client interpretation layer only.
 */

import type {
  ParticipationActivityRow,
  ParticipationAnalyticsPayload,
} from "@/lib/achievement-participation-analytics";
import { computeMedalConversionRate } from "@/lib/analytics/analytics-metrics-definitions";
import { computeAvgParticipationsPerStudent } from "@/lib/analytics/analytics-semantic-registry";
import {
  scaleSliceToPerspective,
  type AnalyticsCountPerspective,
} from "@/lib/analytics/analytics-perspective";

export type DemographicDimensionKey = "section" | "gender" | "mawhiba" | "level" | "stage";

export type DemographicSlice = {
  key: string;
  labelAr: string;
  labelEn: string;
  participations: number;
  medalCount: number;
  conversionPct: number;
};

export type DemographicMatrixRow = {
  dimension: DemographicDimensionKey;
  dimensionLabelAr: string;
  dimensionLabelEn: string;
  slices: DemographicSlice[];
};

export type DemographicParticipationInsight = {
  id: string;
  labelAr: string;
  labelEn: string;
  metricAr: string;
  metricEn: string;
};

export type CompetitionMatrixRow = {
  activityKey: string;
  labelAr: string;
  labelEn: string;
  typeKey: string;
  typeLabelAr: string;
  typeLabelEn: string;
  participations: number;
  students: number;
  density: number;
  conversionPct: number;
  medals: number;
  topSectionAr: string;
  topSectionEn: string;
  topDemographicAr: string;
  topDemographicEn: string;
  topLevelAr: string;
  topLevelEn: string;
};

export type ActivityDemographicBreakdown = {
  activityKey: string;
  labelAr: string;
  labelEn: string;
  participations: number;
  bySection: { arabic: number; international: number };
  byGender: { male: number; female: number };
  byMawhiba: { mawhiba: number; nonMawhiba: number };
  topSliceAr: string;
  topSliceEn: string;
};

export type DistributionBar = {
  key: string;
  labelAr: string;
  labelEn: string;
  count: number;
  drillKey: string;
};

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

const topSliceFromRow = (r: ParticipationActivityRow, isAr: boolean): string => {
  const pairs: Array<[number, string, string]> = [
    [r.arabicParticipants, "عربي", "Arabic"],
    [r.internationalParticipants, "دولي", "International"],
    [r.maleParticipants, "بنين", "Boys"],
    [r.femaleParticipants, "بنات", "Girls"],
    [r.mawhibaParticipants, "موهبة", "Mawhiba"],
    [r.nonMawhibaParticipants, "غير موهبة", "Non-Mawhiba"],
  ];
  const best = pairs.sort((a, b) => b[0] - a[0])[0];
  if (!best || best[0] <= 0) return isAr ? "—" : "—";
  return isAr ? best[1] : best[2];
};

export const buildDemographicMatrix = (
  data: ParticipationAnalyticsPayload,
  table: ParticipationActivityRow[],
  perspective: AnalyticsCountPerspective = "participation"
): DemographicMatrixRow[] => {
  const totalMedals = table.reduce(
    (s, r) => s + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount,
    0
  );
  const totalP = data.kpis.totalParticipations || 1;

  const sectionSlices: DemographicSlice[] = data.charts.sectionParticipation.map((x) => ({
    key: x.key,
    labelAr: x.labelAr,
    labelEn: x.labelEn,
    participations: scaleSliceToPerspective(x.count, data, perspective),
    medalCount: Math.round((x.count / totalP) * totalMedals),
    conversionPct: pct(Math.round((x.count / totalP) * totalMedals), x.count),
  }));

  const genderSlices: DemographicSlice[] = data.charts.genderParticipation.map((x) => {
    const medals =
      data.charts.genderResultStack.find((g) => g.gender === x.key)?.gold ?? 0;
    const gStack = data.charts.genderResultStack.find((g) => g.gender === x.key);
    const mCount = gStack ? gStack.gold + gStack.silver + gStack.bronze + gStack.ranks : 0;
    return {
      key: x.key,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      participations: scaleSliceToPerspective(x.count, data, perspective),
      medalCount: mCount || Math.round((x.count / totalP) * totalMedals),
      conversionPct: pct(mCount, x.count),
    };
  });

  const mawhibaSlices: DemographicSlice[] = data.charts.mawhibaSplit.map((x) => ({
    key: x.key,
    labelAr: x.labelAr,
    labelEn: x.labelEn,
    participations: scaleSliceToPerspective(x.count, data, perspective),
    medalCount: Math.round((x.count / totalP) * totalMedals),
    conversionPct: pct(Math.round((x.count / totalP) * totalMedals), x.count),
  }));

  const levelSlices: DemographicSlice[] = data.charts.levelDistribution.map((x) => ({
    key: x.labelEn || x.labelAr,
    labelAr: x.labelAr,
    labelEn: x.labelEn,
    participations: scaleSliceToPerspective(x.count, data, perspective),
    medalCount: 0,
    conversionPct: 0,
  }));

  return [
    {
      dimension: "section",
      dimensionLabelAr: "القسم (عربي / دولي)",
      dimensionLabelEn: "Section (Arabic / International)",
      slices: sectionSlices,
    },
    {
      dimension: "gender",
      dimensionLabelAr: "الجنس (بنين / بنات)",
      dimensionLabelEn: "Gender (boys / girls)",
      slices: genderSlices,
    },
    {
      dimension: "mawhiba",
      dimensionLabelAr: "الموهبة",
      dimensionLabelEn: "Mawhiba cohort",
      slices: mawhibaSlices,
    },
    {
      dimension: "level",
      dimensionLabelAr: "المستوى / الصف",
      dimensionLabelEn: "Level / grade band",
      slices: levelSlices,
    },
  ];
};

export const buildDemographicParticipationInsights = (
  data: ParticipationAnalyticsPayload,
  table: ParticipationActivityRow[],
  isAr: boolean
): DemographicParticipationInsight[] => {
  const insights: DemographicParticipationInsight[] = [];
  if (table.length === 0) return insights;

  const byParticipation = [...table].sort((a, b) => b.totalParticipations - a.totalParticipations)[0]!;
  const byDensity = [...table]
    .map((r) => ({
      r,
      d: r.distinctParticipants > 0 ? r.totalParticipations / r.distinctParticipants : 0,
    }))
    .sort((a, b) => b.d - a.d)[0];
  const byConversion = [...table]
    .map((r) => ({
      r,
      c:
        r.totalParticipations > 0
          ? ((r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount) / r.totalParticipations) * 100
          : 0,
    }))
    .sort((a, b) => b.c - a.c)[0];

  const maleTotal = table.reduce((s, r) => s + r.maleParticipants, 0);
  const femaleTotal = table.reduce((s, r) => s + r.femaleParticipants, 0);
  const mawTotal = table.reduce((s, r) => s + r.mawhibaParticipants, 0);
  const nonMawTotal = table.reduce((s, r) => s + r.nonMawhibaParticipants, 0);

  insights.push({
    id: "top_activity_participation",
    labelAr: "أكثر نشاط مشاركة",
    labelEn: "Top activity by participation",
    metricAr: `${byParticipation.activityLabelAr} (${byParticipation.totalParticipations} مشاركة)`,
    metricEn: `${byParticipation.activityLabelEn} (${byParticipation.totalParticipations} participations)`,
  });

  if (byDensity) {
    insights.push({
      id: "top_density",
      labelAr: "أعلى كثافة مشاركة",
      labelEn: "Highest participation density",
      metricAr: `${byDensity.r.activityLabelAr} (${byDensity.d.toFixed(2)} مشاركة/طالب)`,
      metricEn: `${byDensity.r.activityLabelEn} (${byDensity.d.toFixed(2)} per student)`,
    });
  }

  if (byConversion) {
    insights.push({
      id: "top_conversion",
      labelAr: "أفضل معدل ميداليات",
      labelEn: "Best medal conversion",
      metricAr: `${byConversion.r.activityLabelAr} (${Math.round(byConversion.c)}%)`,
      metricEn: `${byConversion.r.activityLabelEn} (${Math.round(byConversion.c)}%)`,
    });
  }

  if (maleTotal >= femaleTotal) {
    insights.push({
      id: "gender_male_lead",
      labelAr: "أعلى نشاط للبنين",
      labelEn: "Higher boys participation",
      metricAr: `${maleTotal} مقابل ${femaleTotal}`,
      metricEn: `${maleTotal} vs ${femaleTotal}`,
    });
  } else {
    insights.push({
      id: "gender_female_lead",
      labelAr: "أعلى نشاط للبنات",
      labelEn: "Higher girls participation",
      metricAr: `${femaleTotal} مقابل ${maleTotal}`,
      metricEn: `${femaleTotal} vs ${maleTotal}`,
    });
  }

  if (mawTotal >= nonMawTotal) {
    insights.push({
      id: "mawhiba_lead",
      labelAr: "أفضل أداء لطلاب الموهبة",
      labelEn: "Mawhiba cohort leads",
      metricAr: `${mawTotal} مشاركة موهبة`,
      metricEn: `${mawTotal} Mawhiba participations`,
    });
  } else {
    insights.push({
      id: "non_mawhiba_lead",
      labelAr: "أفضل أداء لغير الموهبة",
      labelEn: "Non-Mawhiba cohort leads",
      metricAr: `${nonMawTotal} مشاركة`,
      metricEn: `${nonMawTotal} participations`,
    });
  }

  const topSection = [...data.charts.sectionParticipation].sort((a, b) => b.count - a.count)[0];
  if (topSection) {
    insights.push({
      id: "top_section",
      labelAr: "القسم الأعلى مشاركة",
      labelEn: "Top section by participation",
      metricAr: `${topSection.labelAr} (${topSection.count})`,
      metricEn: `${topSection.labelEn} (${topSection.count})`,
    });
  }

  const topLevel = [...data.charts.levelDistribution].sort((a, b) => b.count - a.count)[0];
  if (topLevel) {
    insights.push({
      id: "top_level",
      labelAr: "المستوى / الصف الأعلى مشاركة",
      labelEn: "Top level / grade band",
      metricAr: `${topLevel.labelAr} (${topLevel.count})`,
      metricEn: `${topLevel.labelEn} (${topLevel.count})`,
    });
  }

  return insights.slice(0, 9);
};

export const buildCompetitionMatrix = (
  table: ParticipationActivityRow[],
  limit = 12,
  perspective: AnalyticsCountPerspective = "participation"
): CompetitionMatrixRow[] => {
  const rows = [...table]
    .filter((r) => r.totalParticipations > 0)
    .sort((a, b) => b.totalParticipations - a.totalParticipations)
    .slice(0, limit);

  return rows.map((r) => {
    const medals = r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount;
    const density =
      r.distinctParticipants > 0
        ? Math.round((r.totalParticipations / r.distinctParticipants) * 100) / 100
        : 0;
    const conversion =
      r.totalParticipations > 0 ? Math.round((medals / r.totalParticipations) * 1000) / 10 : 0;
    const participations =
      perspective === "student"
        ? r.distinctParticipants
        : perspective === "achievement"
          ? r.approvedAchievements
          : perspective === "result"
            ? medals + r.rankCount
            : r.totalParticipations;
    return {
      activityKey: r.activityKey,
      labelAr: r.activityLabelAr,
      labelEn: r.activityLabelEn,
      typeKey: r.typeKey,
      typeLabelAr: r.typeLabelAr,
      typeLabelEn: r.typeLabelEn,
      participations,
      students: r.distinctParticipants,
      density,
      conversionPct: conversion,
      medals,
      topSectionAr: r.arabicParticipants >= r.internationalParticipants ? "عربي" : "دولي",
      topSectionEn: r.arabicParticipants >= r.internationalParticipants ? "Arabic" : "International",
      topDemographicAr: topSliceFromRow(r, true),
      topDemographicEn: topSliceFromRow(r, false),
      topLevelAr: r.levelLabelAr,
      topLevelEn: r.levelLabelEn,
    };
  });
};

export const buildActivityDemographicBreakdowns = (
  table: ParticipationActivityRow[],
  limit = 6
): ActivityDemographicBreakdown[] =>
  [...table]
    .filter((r) => r.totalParticipations > 0)
    .sort((a, b) => b.totalParticipations - a.totalParticipations)
    .slice(0, limit)
    .map((r) => ({
      activityKey: r.activityKey,
      labelAr: r.activityLabelAr,
      labelEn: r.activityLabelEn,
      participations: r.totalParticipations,
      bySection: { arabic: r.arabicParticipants, international: r.internationalParticipants },
      byGender: { male: r.maleParticipants, female: r.femaleParticipants },
      byMawhiba: { mawhiba: r.mawhibaParticipants, nonMawhiba: r.nonMawhibaParticipants },
      topSliceAr: topSliceFromRow(r, true),
      topSliceEn: topSliceFromRow(r, false),
    }));

export const buildParticipationDistributions = (
  data: ParticipationAnalyticsPayload
): Record<DemographicDimensionKey, DistributionBar[]> => {
  const mapDrill = (dim: string, key: string) => `${dim}:${key}`;

  return {
    section: data.charts.sectionParticipation.map((x) => ({
      key: x.key,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
      drillKey: mapDrill("section", x.key),
    })),
    gender: data.charts.genderParticipation.map((x) => ({
      key: x.key,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
      drillKey: mapDrill("gender", x.key),
    })),
    mawhiba: data.charts.mawhibaSplit.map((x) => ({
      key: x.key,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
      drillKey: mapDrill("mawhiba", x.key),
    })),
    level: data.charts.levelDistribution.map((x) => ({
      key: x.labelEn || x.labelAr,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
      drillKey: mapDrill("level", x.labelEn || x.labelAr),
    })),
    stage: data.charts.levelDistribution.map((x) => ({
      key: x.labelEn || x.labelAr,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
      drillKey: mapDrill("stage", x.labelEn || x.labelAr),
    })),
  };
};

export const buildMultiDimensionalSummary = (data: ParticipationAnalyticsPayload) => ({
  totalParticipations: data.kpis.totalParticipations,
  distinctStudents: data.kpis.distinctStudents,
  avgPerStudent: computeAvgParticipationsPerStudent(
    data.kpis.totalParticipations,
    data.kpis.distinctStudents
  ),
  medalConversionPct: computeMedalConversionRate(data),
});
