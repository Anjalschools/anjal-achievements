import "server-only";

import {
  buildParticipationAnalytics,
  parseParticipationFiltersFromSearchParams,
  type ParticipationAnalyticsFilters,
} from "@/lib/achievement-participation-analytics";
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { buildAnalyticsCanonicalSnapshot } from "@/lib/analytics/analytics-canonical-snapshot";
import { buildAnalyticsNarratives } from "@/lib/analytics/analytics-narrative-engine";
import { buildStrategicSemanticInsights } from "@/lib/analytics/intelligence/analytics-strategic-narrative-engine";
import { computeMedalConversionRate } from "@/lib/analytics/analytics-metrics-definitions";
import { buildStudentIntelligence } from "@/lib/student-intelligence-analytics";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import {
  EXECUTIVE_SNAPSHOT_PAYLOAD_VERSION,
  type ExecutiveAnalyticsSnapshotPayload,
  type ExecutiveSnapshotKpiStrip,
  type ExecutiveSnapshotStudentIntelLite,
} from "@/lib/analytics/server/analytics-snapshot-schema";
import { fingerprintFromParticipationFilters } from "@/lib/analytics/server/analytics-snapshot-fingerprint";
import { fingerprintFromExecutiveFilter } from "@/lib/analytics/server/analytics-snapshot-fingerprint-server";
import { buildAiDecisionSnapshotFromExecutivePayload } from "@/lib/analytics/server/ai-decision-snapshot-engine";

const TOP_STUDENT_ROWS = 12;

const trimStudentIntel = (
  intel: Awaited<ReturnType<typeof buildStudentIntelligence>>
): ExecutiveSnapshotStudentIntelLite => ({
  byWeightedScore: intel.byWeightedScore.slice(0, TOP_STUDENT_ROWS),
  byMedals: intel.byMedals.slice(0, TOP_STUDENT_ROWS),
  byFastestGrowth: intel.byFastestGrowth.slice(0, TOP_STUDENT_ROWS),
});

const buildKpiStrip = (
  general: Awaited<ReturnType<typeof buildParticipationAnalytics>>
): ExecutiveSnapshotKpiStrip => ({
  totalParticipations: general.kpis.totalParticipations,
  uniqueStudents: general.kpis.distinctStudents,
  goldMedalCount: general.kpis.goldMedalCount,
  medalConversionPct: computeMedalConversionRate(general),
  internationalSectionPct: general.kpis.internationalSectionPct ?? 0,
  femalePct: general.kpis.femalePct ?? 0,
});

export const filtersFromExecutiveSnapshot = (f: ExecutiveFilterSnapshot): ParticipationAnalyticsFilters =>
  parseParticipationFiltersFromSearchParams(buildParticipationFilterSearchParams(f));

export const buildExecutiveAnalyticsSnapshot = async (input: {
  filters: ParticipationAnalyticsFilters;
  executiveFilter?: ExecutiveFilterSnapshot;
  persistFingerprint?: boolean;
}): Promise<{ payload: ExecutiveAnalyticsSnapshotPayload; facetMs: number }> => {
  const t0 = Date.now();
  const filterFingerprint =
    input.executiveFilter ?
      fingerprintFromExecutiveFilter(input.executiveFilter)
    : fingerprintFromParticipationFilters(input.filters);

  const [general, studentIntel] = await Promise.all([
    buildParticipationAnalytics({ filters: input.filters, page: 1, pageSize: 25 }),
    buildStudentIntelligence(input.filters, { lite: true }),
  ]);

  const executiveFilter =
    input.executiveFilter ??
    ({
      academicYear: input.filters.academicYear ?? "all",
      gender: input.filters.gender ?? "all",
      stage: input.filters.stage ?? "all",
      grade: input.filters.grade ?? "all",
      section: input.filters.section ?? "all",
      mawhiba: input.filters.mawhiba ?? "all",
      categories: input.filters.categories ?? [],
      levels: input.filters.levels ?? [],
      resultTokens: input.filters.resultTokens ?? [],
      domain: input.filters.domain ?? "",
      organization: input.filters.organization ?? "",
      classification: input.filters.classification ?? "",
      primaryType: input.filters.primaryAchievementType ?? "all",
    } as ExecutiveFilterSnapshot);

  const canonical = buildAnalyticsCanonicalSnapshot({
    general,
    focused: null,
    studentIntel,
  });

  const narrativeBundle = buildAnalyticsNarratives({
    snapshot: canonical,
    general,
    focused: null,
    filters: executiveFilter,
    intelScope: "lite",
    perspective: "participation",
  });

  const strategicInsights = buildStrategicSemanticInsights({
    narratives: narrativeBundle.narratives,
    maxCards: 12,
  });

  const trustIssues: string[] = [];
  if (general.kpis.totalParticipations > 0 && narrativeBundle.narratives.length === 0) {
    trustIssues.push("empty_narratives");
  }

  const facetMs = Date.now() - t0;
  const payload: ExecutiveAnalyticsSnapshotPayload = {
    version: EXECUTIVE_SNAPSHOT_PAYLOAD_VERSION,
    aggregationVersion: CI_AGGREGATION_VERSION,
    computedAt: new Date().toISOString(),
    filterFingerprint,
    kpiStrip: buildKpiStrip(general),
    narrativeBundle,
    strategicInsights,
    insights: narrativeBundle.legacyInsights,
    studentIntelLite: trimStudentIntel(studentIntel),
    narratives: narrativeBundle.narratives,
    trustIssues,
  };

  const aiDecisionBundle = buildAiDecisionSnapshotFromExecutivePayload(payload, general);

  return { payload: { ...payload, aiDecisionBundle }, facetMs };
};

export const defaultExecutiveSnapshotFilters = (): ParticipationAnalyticsFilters =>
  parseParticipationFiltersFromSearchParams(
    buildParticipationFilterSearchParams({
      academicYear: "all",
      gender: "all",
      mawhiba: "all",
      stage: "all",
      grade: "all",
      section: "all",
      categories: [],
      primaryType: "all",
      levels: [],
      resultTokens: [],
      status: "all",
      certificateStatus: "all",
      fromDate: "",
      toDate: "",
      domain: "",
      classification: "",
      organization: "",
      activityYears: [],
      achievementNames: [],
      genders: [],
      mawhibaValues: [],
      stages: [],
      grades: [],
      sections: [],
      statuses: [],
      certificateStatuses: [],
      standardizedTestTypes: [],
    } as ExecutiveFilterSnapshot)
  );
