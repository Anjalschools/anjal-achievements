import { describe, expect, it } from "vitest";
import {
  parseExecutiveSectionsFromUrl,
  serializeExecutiveSectionsToUrl,
  readExecutiveSectionState,
  writeExecutiveSectionState,
} from "@/components/analytics/executive/ExecutiveSectionVisibilityStore";

describe("executive-section-memory", () => {
  it("round-trips section state in url", () => {
    const state = { "exec-kpis": true, "exec-historical": false };
    const params = serializeExecutiveSectionsToUrl(state, new URLSearchParams());
    const parsed = parseExecutiveSectionsFromUrl(params);
    expect(parsed?.["exec-kpis"]).toBe(true);
  });

  it("persists to storage key shape", () => {
    writeExecutiveSectionState({ "exec-kpis": true });
    const read = readExecutiveSectionState();
    expect(read["exec-kpis"]).toBe(true);
  });
});
