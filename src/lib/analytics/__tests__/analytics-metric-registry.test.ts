import { describe, expect, it } from "vitest";
import {
  METRIC_REGISTRY,
  computeMetricFromPayload,
  evaluateMetricSeverity,
  formatMetricValue,
  getMetricDefinition,
  listMetricsByCategory,
  metricExportLabel,
} from "@/lib/analytics/analytics-metric-registry";

describe("analytics-metric-registry", () => {
  it("exposes all required metric ids", () => {
    const ids = Object.keys(METRIC_REGISTRY);
    expect(ids).toContain("participation_count");
    expect(ids).toContain("funnel_success_rate");
    expect(ids).toContain("talent_pipeline_health");
    expect(ids.length).toBeGreaterThanOrEqual(18);
  });

  it("formats percentage metrics", () => {
    const out = formatMetricValue("medal_conversion", 18.5, "en");
    expect(out).toMatch(/18/);
  });

  it("computes conversion metrics from totals", () => {
    const rate = computeMetricFromPayload("medal_conversion", {
      participations: 100,
      students: 50,
      medals: 20,
      nominations: 30,
      acceptances: 10,
    });
    expect(rate).toBe(20);
  });

  it("evaluates severity for lower-is-better metrics", () => {
    const sev = evaluateMetricSeverity("equity_gap", 30);
    expect(sev).toBe("critical");
  });

  it("lists governance metrics", () => {
    const gov = listMetricsByCategory("governance");
    expect(gov.some((m) => m.id === "institutional_growth")).toBe(true);
  });

  it("provides export labels", () => {
    expect(metricExportLabel("participation_count", "ar")).toBe(
      getMetricDefinition("participation_count").exportLabel.ar
    );
  });
});
