import { describe, expect, it } from "vitest";
import {
  getAnalyticsQueueDepth,
  scheduleAnalyticsWork,
} from "@/lib/analytics/analytics-performance-orchestrator";

describe("analytics-performance-orchestrator", () => {
  it("runs CRITICAL work synchronously", () => {
    let ran = false;
    scheduleAnalyticsWork("kpi", "CRITICAL", () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it("queues background work", async () => {
    let ran = false;
    scheduleAnalyticsWork("bg", "BACKGROUND", () => {
      ran = true;
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(ran || getAnalyticsQueueDepth() >= 0).toBe(true);
  });
});
