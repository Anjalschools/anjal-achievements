import { describe, expect, it } from "vitest";
import {
  expandResultTokens,
  matchActivityEvolution,
  normalizeMedalKey,
  resolveMetricAlias,
} from "@/lib/analytics/historical-compatibility-registry";

describe("historical-compatibility-registry", () => {
  it("maps silver medal aliases", () => {
    expect(normalizeMedalKey("فضية")).toBe("silver");
    expect(resolveMetricAlias("silver_medal")).toBe("silver");
  });

  it("expands result tokens", () => {
    const expanded = expandResultTokens(["gold"]);
    expect(expanded.some((t) => /ذهب|gold/i.test(t))).toBe(true);
  });

  it("matches activity evolution patterns", () => {
    expect(matchActivityEvolution("كانجارو", "Kangaroo Math", "kangaroo")).toBe(true);
    expect(matchActivityEvolution("x", "y", "kangaroo")).toBe(false);
  });
});
