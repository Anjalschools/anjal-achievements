import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));
vi.mock("@/models/Achievement", () => ({
  default: {
    aggregate: vi.fn(() => ({
      allowDiskUse: () => Promise.resolve([]),
    })),
  },
}));

describe("focused-runtime-certification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("participants light mode threshold is 1000", async () => {
    const { PARTICIPANTS_LIGHT_MODE_THRESHOLD } = await import(
      "@/lib/achievement-participation-focused-analytics"
    );
    expect(PARTICIPANTS_LIGHT_MODE_THRESHOLD).toBe(1000);
  });

  it("facet scopes are isolated at API contract level", async () => {
    const { buildFocusedActivityFacet } = await import("@/lib/achievement-participation-focused-analytics");
    const Achievement = (await import("@/models/Achievement")).default;

    const aggregateMock = vi.mocked(Achievement.aggregate);
    aggregateMock.mockImplementation(() => {
      const chain = {
        allowDiskUse: vi.fn().mockResolvedValue([
          {
            meta: [{ totalRecords: 5 }],
            stats: [{ approvedRecords: 3 }],
            rows: [{ _id: "a1", resultType: "participation", status: "approved" }],
          },
        ]),
      };
      return chain as unknown as ReturnType<typeof Achievement.aggregate>;
    });

    const baseInput = {
      filters: { academicYear: "all" } as import("@/lib/achievement-participation-analytics").ParticipationAnalyticsFilters,
      focusType: "competition",
      focusRaw: "Math",
      focusedOutcome: "all",
      page: 1,
      pageSize: 25,
    };

    const part = (await buildFocusedActivityFacet({
      ...baseInput,
      scope: "participants",
    })) as Record<string, unknown>;

    expect(part.scope).toBe("participants");
    expect(part.participants).toBeDefined();
    expect(part.charts).toBeUndefined();
    expect(part.decisionPlatform).toBeUndefined();
    expect(part.executive).toBeUndefined();
    expect((part as { kpis?: unknown }).kpis).toBeUndefined();
  });
});

describe("focused-agg-explain", () => {
  it("emits COLLSCAN warning from explain stages", async () => {
    const { inspectFocusedAggregationExplain } = await import("@/lib/analytics/focused-agg-explain");
    const warnings = inspectFocusedAggregationExplain({
      stages: [{ stage: "COLLSCAN", executionTimeMillisEstimate: 100 }],
    });
    expect(warnings.some((w) => w.code === "COLLSCAN")).toBe(true);
  });
});

describe("focused-executive-bundle", () => {
  it("exports segmented full builder without monolithic facet", async () => {
    const mod = await import("@/lib/analytics/focused-executive-bundle");
    expect(typeof mod.buildFocusedExecutiveBundle).toBe("function");
    expect(mod.buildFocusedActivityReport).toBe(mod.buildFocusedExecutiveBundle);
  });
});

describe("focused-facet-budget", () => {
  it("trims participants facet when budget exceeded", async () => {
    const { enforceFocusedFacetBudget } = await import("@/lib/analytics/runtime/focused-facet-budget");
    const filler = "x".repeat(8_192);
    const bigParticipants = Array.from({ length: 600 }, (_, i) => ({
      id: `p-${i}`,
      name: `Student ${i}`,
      notes: filler,
    }));
    const result = enforceFocusedFacetBudget("participants", {
      scope: "participants",
      participants: bigParticipants,
      rankingPool: [{ id: "x" }],
    });
    expect(result.degraded || result.trimmed).toBe(true);
    expect(Array.isArray(result.payload.participants)).toBe(true);
    expect((result.payload.participants as unknown[]).length).toBeLessThanOrEqual(25);
    expect(result.payload.rankingPool).toBeUndefined();
  });
});
