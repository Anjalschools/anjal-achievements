import { describe, expect, it } from "vitest";
import {
  buildAnalyticsTraceMeta,
  traceMetaToExportLines,
} from "@/lib/analytics/analytics-traceability";
import {
  computeMedalConversionRate,
  RANKING_WEIGHT_MATRIX,
} from "@/lib/analytics/analytics-metrics-definitions";
import {
  applyDrillDownToFilter,
  DRILL_RESULT_TOKENS,
} from "@/lib/analytics/analytics-drill-down";
import { defaultExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import {
  analyticsSearchParamsCanonicalString,
  deserializeAnalyticsFiltersFromUrl,
  serializeAnalyticsFiltersToUrl,
} from "@/lib/analytics/report-filter-url-sync";
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const samplePayload = (): ParticipationAnalyticsPayload =>
  ({
    ok: true,
    kpis: {
      totalParticipations: 100,
      distinctStudents: 40,
      goldMedalCount: 10,
      internationalAchievementPct: 12,
    },
    charts: {
      resultOutcomeCompare: [
        { key: "gold", count: 10 },
        { key: "silver", count: 8 },
        { key: "bronze", count: 5 },
      ],
      yearTrend: [],
      sectionParticipation: [],
      activityHorizontal: [],
      genderParticipation: [],
      mawhibaSplit: [],
      resultDistribution: [],
      levelDistribution: [],
      genderResultStack: [],
    },
    table: [],
    tableTotal: 0,
    tablePage: 1,
    tablePageSize: 25,
    activityOptions: [],
  }) as unknown as ParticipationAnalyticsPayload;

describe("analytics metrics governance", () => {
  it("computes medal conversion from governed formula", () => {
    const rate = computeMedalConversionRate(samplePayload());
    expect(rate).toBe(23);
  });

  it("exposes stable ranking weight matrix", () => {
    expect(RANKING_WEIGHT_MATRIX.gold).toBeGreaterThan(RANKING_WEIGHT_MATRIX.silver);
  });
});

describe("filter URL roundtrip", () => {
  it("serializes and deserializes participation filters without losing multi tokens", () => {
    const base = defaultExecutiveFilterSnapshot();
    base.resultTokens = ["medal:gold", "rank:first"];
    base.categories = ["competitions"];
    const sp = serializeAnalyticsFiltersToUrl("participation", base, { tab: "general", page: 2 });
    const parsed = deserializeAnalyticsFiltersFromUrl("participation", sp);
    expect(parsed.filters.resultTokens).toEqual(["medal:gold", "rank:first"]);
    expect(parsed.filters.categories).toEqual(["competitions"]);
    expect(parsed.ui.page).toBe(2);
  });

  it("builds canonical hash stable for same filter set", () => {
    const f = defaultExecutiveFilterSnapshot();
    f.resultTokens = [DRILL_RESULT_TOKENS.gold];
    const a = analyticsSearchParamsCanonicalString(buildParticipationFilterSearchParams(f));
    const b = analyticsSearchParamsCanonicalString(buildParticipationFilterSearchParams(f));
    expect(a).toBe(b);
  });
});

describe("drill-down patches", () => {
  it("applies medal drill without dropping other filters", () => {
    const f = defaultExecutiveFilterSnapshot();
    f.academicYear = "2025-2026م";
    f.categories = ["competitions"];
    const next = applyDrillDownToFilter(f, { resultTokens: [DRILL_RESULT_TOKENS.gold] });
    expect(next.resultTokens).toEqual(["medal:gold"]);
    expect(next.academicYear).toBe("2025-2026م");
    expect(next.categories).toEqual(["competitions"]);
  });
});

describe("traceability metadata", () => {
  it("includes build id and filter hash in export lines", () => {
    const meta = buildAnalyticsTraceMeta({
      searchParams: "academicYear=2025-2026%E2%80%8F%D9%85&result=medal%3Agold",
    });
    const lines = traceMetaToExportLines(meta, false);
    expect(lines.some((l) => l.includes(meta.analyticsBuildId))).toBe(true);
    expect(lines.some((l) => l.includes(meta.canonicalFilterHash))).toBe(true);
  });
});

describe("analytics consistency stub", () => {
  it("chart outcome totals do not exceed participation total", () => {
    const data = samplePayload();
    const sum = data.charts.resultOutcomeCompare.reduce((s, x) => s + x.count, 0);
    expect(sum).toBeLessThanOrEqual(data.kpis.totalParticipations);
  });
});
