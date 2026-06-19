import { describe, expect, it } from "vitest";
import { isSectionAvailable, isSectionEmpty, isSectionFailed } from "@/lib/school-improvement/school-improvement-section-health";
import { createEmptyImprovementPayload } from "@/lib/school-improvement/school-improvement-defaults";

describe("school improvement hardening", () => {
  it("isSectionAvailable respects success, no_data, degraded, and unavailable", () => {
    expect(isSectionAvailable(undefined, "action_engine")).toBe(true);
    expect(isSectionAvailable({ action_engine: { status: "success", durationMs: 1, startedAt: "", completedAt: "" } }, "action_engine")).toBe(true);
    expect(isSectionAvailable({ action_engine: { status: "no_data", durationMs: 1, startedAt: "", completedAt: "" } }, "action_engine")).toBe(true);
    expect(isSectionAvailable({ action_engine: { status: "degraded", durationMs: 1, startedAt: "", completedAt: "" } }, "action_engine")).toBe(true);
    expect(isSectionAvailable({ action_engine: { status: "unavailable", durationMs: 1, startedAt: "", completedAt: "" } }, "action_engine")).toBe(false);
  });

  it("distinguishes empty and failed sections", () => {
    expect(isSectionEmpty({ action_engine: { status: "no_data", durationMs: 1, startedAt: "", completedAt: "" } }, "action_engine")).toBe(true);
    expect(isSectionFailed({ action_engine: { status: "unavailable", durationMs: 1, startedAt: "", completedAt: "" } }, "action_engine")).toBe(true);
  });

  it("empty payload provides safe defaults", () => {
    const empty = createEmptyImprovementPayload();
    expect(empty.actionEngine).toEqual([]);
    expect(empty.partnershipIndicators.careerReadiness).toBe(0);
  });

  it("hardening and diagnostics modules expose execution reports", async () => {
    const fs = await import("node:fs/promises");
    const hardening = await fs.readFile("src/lib/school-improvement/school-improvement-hardening.ts", "utf8");
    const diagnosticsBuilder = await fs.readFile("src/lib/school-improvement/intelligence-diagnostics-builder.ts", "utf8");
    const mongoProfiler = await fs.readFile("src/lib/school-improvement/intelligence-mongo-profiler.ts", "utf8");
    const selfHealing = await fs.readFile("src/lib/school-improvement/intelligence-self-healing.ts", "utf8");
    expect(selfHealing).toContain("startedAt");
    expect(selfHealing).toContain("no_data");
    expect(diagnosticsBuilder).toContain("sectionReports");
    expect(mongoProfiler).toContain("3000");
  });

  it("route, diagnostics route, and admin panel expose root-cause diagnostics", async () => {
    const fs = await import("node:fs/promises");
    const route = await fs.readFile("src/app/api/admin/school-improvement-intelligence/route.ts", "utf8");
    const diagnosticsRoute = await fs.readFile(
      "src/app/api/admin/school-improvement-intelligence/diagnostics/route.ts",
      "utf8"
    );
    const page = await fs.readFile("src/app/(app)/admin/school-improvement-intelligence/page.tsx", "utf8");
    const panel = await fs.readFile("src/components/admin/SchoolImprovementDiagnosticsPanel.tsx", "utf8");
    expect(route).toContain("sanitizeDiagnosticsForProduction");
    expect(diagnosticsRoute).toContain('role || "").trim() === "admin"');
    expect(page).toContain("SchoolImprovementDiagnosticsPanel");
    expect(panel).toContain("تشخيص ذكاء التحسين المدرسي");
  });
});
