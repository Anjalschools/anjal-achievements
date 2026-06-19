import { describe, expect, it } from "vitest";
import {
  calculateIntelligenceHealthScore,
  resolveHealthBand,
} from "@/lib/school-improvement/intelligence-health-score";
import type { SchoolImprovementFullDiagnostics } from "@/lib/school-improvement/intelligence-diagnostics-types";

const baseDiagnostics = (): SchoolImprovementFullDiagnostics => ({
  generatedAt: new Date().toISOString(),
  totalDurationMs: 1200,
  sections: {},
  sectionReports: [
    {
      section: "action_engine",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 100,
      status: "success",
    },
  ],
  warnings: [],
  slow: false,
  slowSections: [],
  healthySections: ["action_engine"],
  unavailableSections: [],
  mongoQueries: [],
  aggregationFailures: [],
  modelIssues: [],
  environment: [
    { key: "mongodb", labelAr: "MongoDB", labelEn: "MongoDB", status: "healthy" },
    { key: "openai", labelAr: "OpenAI", labelEn: "OpenAI", status: "warning" },
  ],
});

describe("intelligence health score", () => {
  it("returns excellent band for healthy diagnostics", () => {
    const result = calculateIntelligenceHealthScore(baseDiagnostics());
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.band).toBe("excellent");
    expect(result.labelAr).toBe("ممتاز");
  });

  it("deducts for unavailable sections and failed environment", () => {
    const diagnostics = baseDiagnostics();
    diagnostics.unavailableSections = ["partnership_indicators", "summary"];
    diagnostics.sectionReports.push(
      {
        section: "partnership_indicators",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 50,
        status: "unavailable",
      },
      {
        section: "summary",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 50,
        status: "unavailable",
      }
    );
    diagnostics.environment.push({
      key: "mongodb",
      labelAr: "MongoDB",
      labelEn: "MongoDB",
      status: "failed",
      detail: "Ping failed",
    });
    const result = calculateIntelligenceHealthScore(diagnostics);
    expect(result.score).toBeLessThan(80);
    expect(["needs_attention", "critical"]).toContain(result.band);
  });

  it("maps score bands", () => {
    expect(resolveHealthBand(96).labelAr).toBe("ممتاز");
    expect(resolveHealthBand(88).labelAr).toBe("جيد جداً");
    expect(resolveHealthBand(75).labelAr).toBe("يحتاج متابعة");
    expect(resolveHealthBand(60).labelAr).toBe("يحتاج تدخل فوري");
  });
});

describe("intelligence health monitoring wiring", () => {
  it("includes monitoring models and routes", async () => {
    const fs = await import("node:fs/promises");
    expect(await fs.readFile("src/models/IntelligenceHealthSnapshot.ts", "utf8")).toContain("healthScore");
    expect(await fs.readFile("src/models/IntelligenceHealthAlert.ts", "utf8")).toContain("occurrenceCount");
    expect(await fs.readFile("src/lib/school-improvement/intelligence-health-monitor.ts", "utf8")).toContain(
      "processIntelligenceHealthMonitoring"
    );
    expect(await fs.readFile("src/app/api/admin/intelligence-health/route.ts", "utf8")).toContain("loadIntelligenceHealthDashboard");
    expect(await fs.readFile("src/app/(app)/admin/intelligence-health/page.tsx", "utf8")).toContain(
      "مركز صحة الذكاء المؤسسي"
    );
  });
});
