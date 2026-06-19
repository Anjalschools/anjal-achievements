import { describe, expect, it } from "vitest";
import {
  getSectionRecoveryMessage,
  isSectionAvailable,
  isSectionDegraded,
  listDegradedSections,
} from "@/lib/school-improvement/school-improvement-section-health";

describe("intelligence self-healing section health", () => {
  it("treats degraded sections as available for rendering", () => {
    const health = {
      action_engine: {
        status: "degraded" as const,
        startedAt: "",
        completedAt: "",
        durationMs: 10,
        snapshotFallback: true,
      },
    };
    expect(isSectionAvailable(health, "action_engine")).toBe(true);
    expect(isSectionDegraded(health, "action_engine")).toBe(true);
    expect(listDegradedSections(health)).toEqual(["action_engine"]);
  });

  it("returns Arabic snapshot fallback message", () => {
    const health = {
      summary: {
        status: "degraded" as const,
        startedAt: "",
        completedAt: "",
        durationMs: 1,
        recovery: {
          retryCount: 3,
          recoveredAfterRetry: false,
          snapshotFallback: true,
          recoveryDurationMs: 9000,
          outcome: "snapshot_fallback" as const,
          messageAr: "تم عرض آخر نسخة ناجحة من البيانات",
          messageEn: "Showing last successful snapshot",
        },
      },
    };
    expect(getSectionRecoveryMessage(health, "summary", true)).toBe("تم عرض آخر نسخة ناجحة من البيانات");
  });

  it("self-healing modules expose retry schedule and snapshot fallback", async () => {
    const fs = await import("node:fs/promises");
    const selfHealing = await fs.readFile("src/lib/school-improvement/intelligence-self-healing.ts", "utf8");
    const resilience = await fs.readFile("src/lib/school-improvement/intelligence-resilience-score.ts", "utf8");
    const actions = await fs.readFile("src/app/api/admin/intelligence-health/actions/route.ts", "utf8");
    const healthCenter = await fs.readFile("src/components/admin/InstitutionalIntelligenceHealthCenter.tsx", "utf8");

    expect(selfHealing).toContain("RETRY_DELAYS_MS = [0, 2000, 5000]");
    expect(selfHealing).toContain("recoveredAfterRetry");
    expect(selfHealing).toContain("snapshot_fallback");
    expect(resilience).toContain("calculateResilienceScore");
    expect(actions).toContain("rerun_diagnostics");
    expect(actions).toContain("clear_stale_snapshots");
    expect(healthCenter).toContain("Resilience score");
    expect(healthCenter).toContain("Recovery rate");
  });
});
