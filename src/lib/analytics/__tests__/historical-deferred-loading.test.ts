import { describe, expect, it } from "vitest";
import { scheduleAnalyticsWork } from "@/lib/analytics/analytics-performance-orchestrator";

describe("historical-deferred-loading", () => {
  it("schedules historical intelligence on background priority", async () => {
    let done = false;
    scheduleAnalyticsWork("historical-deferred-test", "BACKGROUND", () => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 40));
    expect(done).toBe(true);
  });
});
