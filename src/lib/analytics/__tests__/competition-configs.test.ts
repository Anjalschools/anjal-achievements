import { describe, expect, it } from "vitest";
import { MAWHIBA_OLYMPIAD_CONFIG } from "@/lib/competitions/competition-configs";

describe("competition-configs", () => {
  it("switches olympiad columns at 2026", () => {
    const legacy = MAWHIBA_OLYMPIAD_CONFIG.resolveColumns(2025);
    const nasmo = MAWHIBA_OLYMPIAD_CONFIG.resolveColumns(2026);
    expect(legacy.some((c) => c.key === "mawhiba")).toBe(true);
    expect(nasmo.some((c) => c.key === "nasmo_1")).toBe(true);
  });
});
