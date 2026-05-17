import "server-only";
import connectDB from "@/lib/mongodb";
import { getLatestCompetitionSnapshot } from "@/lib/competition/analytics/historical-metrics";
import type { CompetitionSnapshotPayload } from "@/lib/competition/analytics/snapshot-engine";
import type { ParticipationAnalyticsFilters } from "@/lib/achievement-participation-analytics";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

export const buildParticipationSnapshotFallback = async (input: {
  filters: ParticipationAnalyticsFilters;
  page: number;
  pageSize: number;
}): Promise<ParticipationAnalyticsPayload | null> => {
  await connectDB();
  const snap = await getLatestCompetitionSnapshot("daily");
  const sp = snap?.payload as CompetitionSnapshotPayload | undefined;
  if (!sp) return null;

  return {
    ok: true,
    generatedAt: sp.computedAt,
    filters: input.filters,
    kpis: sp.kpis as ParticipationAnalyticsPayload["kpis"],
    charts: {
      genderParticipation: [],
      sectionParticipation: [],
      mawhibaSplit: [],
      resultDistribution: [],
      levelDistribution: [],
      genderResultStack: [],
      topPrograms: [],
      activityHorizontal: [],
      resultOutcomeCompare: sp.outcomes.map((o) => ({
        key: o.key,
        labelAr: o.key,
        labelEn: o.key,
        count: o.count,
        color: "#94a3b8",
      })),
      yearTrend: sp.growth.yearTrend,
    },
    activityOptions: [],
    focusedActivity: null,
    table: [],
    tableTotal: 0,
    page: input.page,
    pageSize: input.pageSize,
  };
};
