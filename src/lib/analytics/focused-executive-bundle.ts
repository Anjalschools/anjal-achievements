/**
 * Segmented scope=full orchestration — composes isolated facets in Node.js (no monolithic $facet BSON).
 */

import "server-only";
import connectDB from "@/lib/mongodb";
import { buildCompetitionDecisionPlatform } from "@/lib/competition-decision-intelligence";
import { buildTopPerformersFromRankingPool } from "@/lib/analytics/build-top-performers-weighted";
import {
  assessFocusedFullPayload,
  clampFocusedFullPageSize,
  MAX_INSIGHT_ITEMS,
} from "@/lib/analytics/focused-full-guards";
import { sanitizeFocusedChartsPayload } from "@/lib/analytics/focused-chart-validation";
import { buildFocusedProgressiveShell } from "@/lib/analytics/focused-progressive-shell";
import {
  trimFocusedPayloadForTransport,
  validateFocusedPayloadSize,
} from "@/lib/analytics/focused-payload-governor";
import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";
import type { ParticipationAnalyticsFilters } from "@/lib/achievement-participation-analytics";
import {
  aggregateFocusedKpiMetrics,
  buildFocusedChartsPayload,
  buildFocusedEnvelope,
  buildFocusedExecutivePayload,
  buildFocusedParticipantsPayload,
  buildFocusPipeline,
  loadFocusedRankingPoolSlice,
  loadPeerActivityMetrics,
} from "@/lib/achievement-participation-focused-analytics";

export type FocusedExecutiveBundleInput = {
  filters: ParticipationAnalyticsFilters;
  focusType: string;
  focusRaw: string;
  focusedOutcome: string;
  page?: number;
  pageSize?: number;
};

const defaultKpi = (): FocusedActivityReportPayload["kpis"] => ({
  totalRecords: 0,
  distinctStudents: 0,
  approvedRecords: 0,
  excellenceRatePct: 0,
});

const trimDecisionPlatform = (
  dp: FocusedActivityReportPayload["decisionPlatform"]
): FocusedActivityReportPayload["decisionPlatform"] => ({
  ...dp,
  alerts: dp.alerts.slice(0, MAX_INSIGHT_ITEMS),
  recommendations: dp.recommendations.slice(0, MAX_INSIGHT_ITEMS),
});

/**
 * Progressive segmented full report — parallel isolated queries, composed in Node (BSON-safe).
 */
export const buildFocusedExecutiveBundle = async (
  input: FocusedExecutiveBundleInput
): Promise<FocusedActivityReportPayload & { degraded?: boolean }> => {
  await connectDB();

  const page = Math.max(1, input.page ?? 1);
  const pageSize = clampFocusedFullPageSize(input.pageSize);
  const segmentInput = {
    filters: input.filters,
    focusType: input.focusType,
    focusRaw: input.focusRaw,
    focusedOutcome: input.focusedOutcome,
    page,
    pageSize,
  };

  const base = buildFocusedEnvelope(segmentInput);
  const { pipeline } = buildFocusPipeline(segmentInput);

  let degraded = false;

  const [kpiSettled, participantsSettled, chartsSettled, peerSettled, rankingSettled] =
    await Promise.allSettled([
      aggregateFocusedKpiMetrics(pipeline),
      buildFocusedParticipantsPayload(segmentInput),
      buildFocusedChartsPayload(segmentInput, pipeline),
      loadPeerActivityMetrics(input.filters),
      loadFocusedRankingPoolSlice(pipeline),
    ]);

  const kpi =
    kpiSettled.status === "fulfilled" ? kpiSettled.value : (() => {
      degraded = true;
      return defaultKpi();
    })();

  const participantsPart =
    participantsSettled.status === "fulfilled"
      ? participantsSettled.value
      : (() => {
          degraded = true;
          return {
            participants: [] as FocusedActivityReportPayload["participants"],
            page,
            pageSize,
            totalParticipants: 0,
            participantsLightMode: false,
            meta: { approvedRecords: 0 },
          };
        })();

  const chartsRaw =
    chartsSettled.status === "fulfilled"
      ? chartsSettled.value
      : (() => {
          degraded = true;
          return buildFocusedProgressiveShell(base).charts;
        })();

  const charts = sanitizeFocusedChartsPayload(chartsRaw);
  const peerRows = peerSettled.status === "fulfilled" ? peerSettled.value : [];
  if (peerSettled.status === "rejected") degraded = true;

  let executive: FocusedActivityReportPayload["executive"];
  try {
    executive = await buildFocusedExecutivePayload(segmentInput, pipeline, kpi, charts);
  } catch {
    degraded = true;
    executive = buildFocusedProgressiveShell(base).executive;
  }

  if (rankingSettled.status === "fulfilled" && rankingSettled.value.length > 0) {
    const weighted = buildTopPerformersFromRankingPool(rankingSettled.value);
    if (weighted.byWeighted.length > 0) {
      executive = {
        ...executive,
        topPerformers: {
          ...executive.topPerformers,
          byWeighted: weighted.byWeighted,
        },
      };
    }
  } else if (rankingSettled.status === "rejected") {
    degraded = true;
  }

  const ytSorted = [...charts.yearTrend].sort((a, b) => a.year - b.year);
  const yCurr = ytSorted.length ? ytSorted[ytSorted.length - 1]! : null;
  const yPrev = ytSorted.length >= 2 ? ytSorted[ytSorted.length - 2]! : null;
  const rb = charts.resultBars;
  const gold = rb.find((x) => x.key === "gold")?.count ?? 0;
  const silver = rb.find((x) => x.key === "silver")?.count ?? 0;
  const bronze = rb.find((x) => x.key === "bronze")?.count ?? 0;

  let decisionPlatform: FocusedActivityReportPayload["decisionPlatform"];
  try {
    decisionPlatform = trimDecisionPlatform(
      buildCompetitionDecisionPlatform({
        activityLabelAr: base.activityLabelAr,
        activityLabelEn: base.activityLabelEn,
        focusType: segmentInput.focusType,
        focusRaw: segmentInput.focusRaw,
        totalRecords: kpi.totalRecords,
        distinctStudents: kpi.distinctStudents,
        approvedRecords: kpi.approvedRecords,
        excellenceRatePct: kpi.excellenceRatePct,
        gold,
        silver,
        bronze,
        nomination: rb.find((x) => x.key === "nomination")?.count ?? 0,
        participation: rb.find((x) => x.key === "participation")?.count ?? 0,
        executive,
        yCurr,
        yPrev,
        peerRows,
      })
    );
  } catch {
    degraded = true;
    decisionPlatform = buildFocusedProgressiveShell(base).decisionPlatform;
  }

  let payload: FocusedActivityReportPayload & { degraded?: boolean } = {
    ok: true,
    generatedAt: base.generatedAt,
    filters: base.filters,
    focusType: base.focusType,
    focusRaw: base.focusRaw,
    activityLabelAr: base.activityLabelAr,
    activityLabelEn: base.activityLabelEn,
    focusedOutcome: base.focusedOutcome,
    kpis: {
      totalRecords: kpi.totalRecords,
      distinctStudents: kpi.distinctStudents,
      approvedRecords: kpi.approvedRecords,
      excellenceRatePct: kpi.excellenceRatePct,
    },
    charts,
    executive,
    decisionPlatform,
    participants: participantsPart.participants,
    page: participantsPart.page,
    pageSize: participantsPart.pageSize,
    totalParticipants: participantsPart.totalParticipants,
  };

  const guard = assessFocusedFullPayload(payload);
  if (guard.degraded) degraded = true;

  if (guard.exceeded) {
    const governance = validateFocusedPayloadSize(payload, { scope: "full" });
    payload = trimFocusedPayloadForTransport(
      { ...payload, degraded: true },
      governance
    ) as typeof payload;
    degraded = true;
  }

  if (degraded) {
    payload = { ...payload, degraded: true };
  }

  return payload;
};

/** Legacy export name used by export/PDF paths. */
export const buildFocusedActivityReport = buildFocusedExecutiveBundle;
