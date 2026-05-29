/**
 * Historical Educational Intelligence — orchestrates registry, trends, cube, funnel, alerts.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import { ROW_CATEGORIES } from "@/lib/analytics/shared/historical-row-categories";
import { buildEducationalHistoricalCube } from "@/lib/analytics/educational-historical-cube";
import {
  buildAllActivityTrendIntelligence,
  buildActivityTrendIntelligence,
  buildEquityTrendIntelligence,
  buildPlatformTrendIntelligence,
  buildSectionTrendIntelligence,
  type HistoricalTrendIntelligence,
} from "@/lib/analytics/historical-trend-intelligence";
import { buildHistoricalFunnelIntelligence } from "@/lib/analytics/historical-funnel-intelligence";
import { buildHistoricalAlerts, type HistoricalAlert } from "@/lib/analytics/historical-alert-engine";
import {
  buildHistoricalIntelligenceNarratives,
  type HistoricalIntelligenceNarrative,
} from "@/lib/analytics/historical-intelligence-narratives";
import {
  readHistoricalCache,
  stableAnalyticsHash,
  writeHistoricalCache,
} from "@/lib/analytics/analytics-historical-cache-v2";
import type { HeatmapCellInput } from "@/components/analytics/IntensityHeatmapGrid";
import { formatExecutiveCagr } from "@/lib/analytics/ai/executive-intelligence/executive-wording-engine";
import { formatOrderedFunnelPathway } from "@/lib/analytics/ai/executive-intelligence/executive-funnel-pathway";

export type HistoricalExecutiveKpi = {
  id: string;
  labelAr: string;
  labelEn: string;
  value: string;
  subAr?: string;
  subEn?: string;
  tone: "positive" | "negative" | "neutral" | "warning";
};

export type TableIntelligenceOverlay = {
  activityKey: string;
  cagr: number;
  consistencyScore: number;
  peakYear: number;
  semantic: HistoricalTrendIntelligence["semantic"];
  volatility: number;
};

export type HistoricalEducationalIntelligence = {
  timelineId: string;
  cube: ReturnType<typeof buildEducationalHistoricalCube>;
  activityTrends: HistoricalTrendIntelligence[];
  sectionTrends: HistoricalTrendIntelligence[];
  platformTrend?: HistoricalTrendIntelligence | null;
  equityTrend?: HistoricalTrendIntelligence | null;
  funnel: ReturnType<typeof buildHistoricalFunnelIntelligence>;
  alerts: HistoricalAlert[];
  narratives: HistoricalIntelligenceNarrative[];
  executiveKpis: HistoricalExecutiveKpi[];
  heatmapCells: HeatmapCellInput[];
  tableOverlays: Record<string, TableIntelligenceOverlay>;
  strongestGrowth: HistoricalTrendIntelligence | null;
  biggestDecline: HistoricalTrendIntelligence | null;
  mostStable: HistoricalTrendIntelligence | null;
};

const buildHeatmapCells = (trends: HistoricalTrendIntelligence[]): HeatmapCellInput[] =>
  trends
    .filter((t) => t.scope.kind === "activity")
    .map((t) => {
      const intensity = Math.min(
        100,
        Math.max(0, Math.abs(t.cagr) * 3 + t.consistency.overall * 0.4)
      );
      const severity =
        t.semantic === "declining"
          ? ("critical" as const)
          : t.semantic === "volatile"
            ? ("warning" as const)
            : t.cagr >= 8
              ? ("info" as const)
              : undefined;
      return {
        key: `${t.scope.key}-${t.metricId}`,
        labelAr: t.scope.labelAr,
        labelEn: t.scope.labelEn,
        intensity,
        sharePct: Math.max(0, t.consistency.overall),
        severity,
        drillSource: "activity_row" as const,
      };
    });

const buildExecutiveKpis = (
  strongest: HistoricalTrendIntelligence | null,
  decline: HistoricalTrendIntelligence | null,
  stable: HistoricalTrendIntelligence | null,
  funnel: HistoricalEducationalIntelligence["funnel"]
): HistoricalExecutiveKpi[] => {
  const kpis: HistoricalExecutiveKpi[] = [];
  if (strongest) {
    const cagrAr = formatExecutiveCagr(strongest.cagr, strongest.series.length, { locale: "ar" });
    const cagrEn = formatExecutiveCagr(strongest.cagr, strongest.series.length, { locale: "en" });
    kpis.push({
      id: "strongest_growth",
      labelAr: "أقوى نمو",
      labelEn: "Strongest growth",
      value: strongest.scope.labelAr,
      subAr: cagrAr.display,
      subEn: cagrEn.display,
      tone: "positive",
    });
  }
  if (decline) {
    const cagrAr = formatExecutiveCagr(decline.cagr, decline.series.length, { locale: "ar" });
    const cagrEn = formatExecutiveCagr(decline.cagr, decline.series.length, { locale: "en" });
    kpis.push({
      id: "biggest_decline",
      labelAr: "أكبر تراجع",
      labelEn: "Biggest decline",
      value: decline.scope.labelAr,
      subAr: cagrAr.display,
      subEn: cagrEn.display,
      tone: "negative",
    });
  }
  if (stable) {
    kpis.push({
      id: "most_stable",
      labelAr: "الأكثر استقرارًا",
      labelEn: "Most stable",
      value: stable.scope.labelAr,
      subAr: `${stable.consistency.overall}/100`,
      subEn: `${stable.consistency.overall}/100`,
      tone: "neutral",
    });
  }
  if (funnel) {
    const latest = funnel.snapshots[funnel.snapshots.length - 1];
    const latestStrength = latest?.pipelineStrength ?? 0;
    const pathwayAr = latest
      ? formatOrderedFunnelPathway(latest.displayStages, true)
      : "";
    const pathwayEn = latest
      ? formatOrderedFunnelPathway(latest.displayStages, false)
      : "";
    kpis.push({
      id: "funnel_quality",
      labelAr: "جودة المسار",
      labelEn: "Pipeline quality",
      value: funnel.sufficient ? `${latestStrength}%` : "—",
      subAr: pathwayAr || funnel.narrativeAr.slice(0, 80),
      subEn: pathwayEn || funnel.narrativeEn.slice(0, 80),
      tone: !funnel.sufficient ? "neutral" : funnel.funnelLeakage > 45 ? "warning" : "positive",
    });
  }
  return kpis;
};

export const buildTableIntelligenceOverlay = (
  trend: HistoricalTrendIntelligence | null
): TableIntelligenceOverlay | null => {
  if (!trend) return null;
  return {
    activityKey: trend.scope.key,
    cagr: trend.cagr,
    consistencyScore: trend.consistency.overall,
    peakYear: trend.peaks.bestYear,
    semantic: trend.semantic,
    volatility: trend.volatility,
  };
};

export const buildHistoricalEducationalIntelligence = (
  slices: HistoricalYearSlice[],
  tables: HistoricalComparisonTableModel[] = []
): HistoricalEducationalIntelligence | null => {
  if (slices.length < 2) return null;

  const years = slices.map((s) => s.year).sort((a, b) => a - b);
  const key = stableAnalyticsHash({
    y: years.join(","),
    t: String(tables.length),
    p: String(slices[0]?.payload.kpis.totalParticipations ?? 0),
  });

  const cached = readHistoricalCache<HistoricalEducationalIntelligence>("intelligence", key);
  if (cached) return cached;

  const build = (): HistoricalEducationalIntelligence => {
    const cube = buildEducationalHistoricalCube(slices);
    const activityTrends = buildAllActivityTrendIntelligence(slices, "participation_count");
    const medalTrends = buildAllActivityTrendIntelligence(slices, "medal_count");

    const sectionTrends: HistoricalTrendIntelligence[] = [];
    const kangaroo = ACTIVITY_FAMILIES.find((f) => f.key === "kangaroo");
    if (kangaroo) {
      for (const cat of ROW_CATEGORIES) {
        const intel = buildSectionTrendIntelligence(slices, kangaroo, cat.key);
        if (intel) sectionTrends.push(intel);
      }
    }

    const platformTrend = buildPlatformTrendIntelligence(slices);
    const equityTrend = buildEquityTrendIntelligence(slices);
    const funnel = buildHistoricalFunnelIntelligence(slices);

    const mergedTrends = [...activityTrends, ...medalTrends];
    const alerts = buildHistoricalAlerts({ trends: mergedTrends, funnel });
    const narratives = buildHistoricalIntelligenceNarratives({
      activityTrends,
      sectionTrends,
      funnel,
      alerts,
      yearCount: slices.length,
      funnelConfidence: funnel?.funnelConfidence,
    });

    const strongestGrowth = activityTrends[0] ?? null;
    const biggestDecline =
      [...activityTrends].sort((a, b) => a.cagr - b.cagr)[0] ?? null;
    const mostStable =
      [...activityTrends].sort(
        (a, b) => b.consistency.overall - a.consistency.overall
      )[0] ?? null;

    const tableOverlays: Record<string, TableIntelligenceOverlay> = {};
    for (const table of tables) {
      const family = ACTIVITY_FAMILIES.find((f) => f.key === table.activityFamilyKey);
      if (!family) continue;
      const trend = buildActivityTrendIntelligence(slices, family);
      const overlay = buildTableIntelligenceOverlay(trend);
      if (overlay) tableOverlays[table.id] = overlay;
    }

    return {
      timelineId: cube.timelineId,
      cube,
      activityTrends,
      sectionTrends,
      platformTrend,
      equityTrend,
      funnel,
      alerts,
      narratives,
      executiveKpis: buildExecutiveKpis(strongestGrowth, biggestDecline, mostStable, funnel),
      heatmapCells: buildHeatmapCells(activityTrends),
      tableOverlays,
      strongestGrowth,
      biggestDecline,
      mostStable,
    };
  };

  const result = build();
  writeHistoricalCache("intelligence", key, result);
  return result;
};
