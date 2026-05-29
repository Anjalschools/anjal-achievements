import { describe, expect, it } from "vitest";
import {
  parsePerspectiveParam,
  perspectiveToUrlValue,
  PERSPECTIVE_URL_ALIASES,
} from "@/lib/analytics/analytics-perspective";

describe("analytics-perspective-context helpers", () => {
  it("maps URL aliases to canonical perspectives", () => {
    expect(parsePerspectiveParam("participations")).toBe("participation");
    expect(parsePerspectiveParam("students")).toBe("student");
    expect(parsePerspectiveParam("achievements")).toBe("achievement");
    expect(parsePerspectiveParam("records")).toBe("record");
    expect(parsePerspectiveParam("results")).toBe("result");
  });

  it("defaults unknown params to participation", () => {
    expect(parsePerspectiveParam(null)).toBe("participation");
    expect(parsePerspectiveParam("unknown")).toBe("participation");
  });

  it("serializes perspectives for URL storage", () => {
    expect(perspectiveToUrlValue("student")).toBe("students");
    expect(perspectiveToUrlValue("participation")).toBe("participations");
  });

  it("covers all five alias groups", () => {
    expect(Object.keys(PERSPECTIVE_URL_ALIASES).length).toBeGreaterThanOrEqual(10);
  });
});
