import { describe, expect, it } from "vitest";
import { enqueueBackgroundAnalytics } from "@/lib/analytics/analytics-background-worker";

describe("analytics-background-worker", () => {
  it("completes background job", async () => {
    const result = await new Promise<number>((resolve) => {
      enqueueBackgroundAnalytics({
        id: "score",
        run: () => 42,
        onComplete: resolve,
      });
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(result).toBe(42);
  });
});
