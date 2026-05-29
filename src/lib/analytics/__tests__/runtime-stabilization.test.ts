import { describe, expect, it } from "vitest";
import { slimStudentIntelligenceLitePayload } from "@/lib/analytics/runtime/slim-student-intel-payload";
import type { StudentIntelRow, StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import { abortInflightByPrefix, fetchInflightDeduped } from "@/lib/analytics/runtime/analytics-inflight-registry";

const row = (id: string): StudentIntelRow => ({
  participantId: id,
  nameAr: `طالب ${id}`,
  nameEn: `Student ${id}`,
  avatarUrl: "https://example.com/a.jpg",
  school: "مدرسة",
  stageKey: "primary",
  stageLabelAr: "ابتدائي",
  stageLabelEn: "Primary",
  sectionKey: "arabic",
  mawhiba: false,
  recordCount: 10,
  medalCount: 2,
  medalRatioPct: 20,
  distinctActivityCount: 3,
});

describe("slimStudentIntelligenceLitePayload", () => {
  it("caps lists and strips avatars for lite responses", () => {
    const payload: StudentIntelligencePayload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      filters: { academicYear: "2025-2026م", heavy: true },
      byWeightedScore: Array.from({ length: 20 }, (_, i) => row(`w${i}`)),
      byParticipation: Array.from({ length: 20 }, (_, i) => row(`p${i}`)),
      byMedals: Array.from({ length: 20 }, (_, i) => row(`m${i}`)),
      bySuccessRate: Array.from({ length: 20 }, (_, i) => row(`s${i}`)),
      byActivityDiversity: [row("d1")],
      byFastestGrowth: [row("g1")],
    };

    const slim = slimStudentIntelligenceLitePayload(payload);
    expect(slim.byParticipation).toHaveLength(8);
    expect(slim.byActivityDiversity).toHaveLength(0);
    expect(slim.byFastestGrowth).toHaveLength(0);
    expect(slim.byParticipation[0]?.avatarUrl).toBe("");
    expect(slim.filters).toEqual({ intelScope: "lite" });
  });
});

describe("fetchInflightDeduped", () => {
  it("dedupes concurrent calls with the same key", async () => {
    let calls = 0;
    const p1 = fetchInflightDeduped("test-key", async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return "ok";
    });
    const p2 = fetchInflightDeduped("test-key", async () => {
      calls += 1;
      return "other";
    });
    const [a, b] = await Promise.all([p1, p2]);
    expect(calls).toBe(1);
    expect(a).toBe("ok");
    expect(b).toBe("ok");
    abortInflightByPrefix("test-key");
  });
});
