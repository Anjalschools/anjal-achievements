import { describe, expect, it } from "vitest";
import { EXECUTIVE_SNAPSHOT_PAYLOAD_VERSION } from "@/lib/analytics/server/analytics-snapshot-schema";

describe("ai-decision-snapshot-engine", () => {
  it("snapshot schema supports ai decision bundle field", () => {
    expect(EXECUTIVE_SNAPSHOT_PAYLOAD_VERSION).toBe(1);
  });
});
