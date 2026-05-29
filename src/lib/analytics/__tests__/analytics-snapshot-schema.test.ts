import { describe, expect, it } from "vitest";
import { EXECUTIVE_SNAPSHOT_PAYLOAD_VERSION } from "@/lib/analytics/server/analytics-snapshot-schema";

describe("analytics-snapshot-schema", () => {
  it("uses version 1 payload contract", () => {
    expect(EXECUTIVE_SNAPSHOT_PAYLOAD_VERSION).toBe(1);
  });
});
