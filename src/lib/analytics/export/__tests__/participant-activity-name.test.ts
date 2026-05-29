import { describe, expect, it } from "vitest";
import { resolveParticipantActivityLabel } from "@/lib/analytics/export/participant-activity-name";

describe("resolveParticipantActivityLabel", () => {
  it("uses focusRaw when doc activityRaw equals type key only", () => {
    const label = resolveParticipantActivityLabel(
      {
        achievementType: "competition",
        activityRaw: "competition",
      },
      "en",
      { focusType: "competition", focusRaw: "bebras" }
    );
    expect(label.toLowerCase()).toContain("bebras");
    expect(label).not.toContain("unspecified");
    expect(label).not.toContain("بدون اسم محدد");
  });

  it("prefers achievementName from doc over type default", () => {
    const label = resolveParticipantActivityLabel(
      {
        achievementType: "competition",
        achievementName: "Kangaroo",
        activityRaw: "competition",
      },
      "en",
      { focusType: "competition", focusRaw: "" }
    );
    expect(label.toLowerCase()).toMatch(/kangaroo/);
    expect(label).not.toContain("unspecified");
  });

  it("uses scoped envelope label in light mode", () => {
    const label = resolveParticipantActivityLabel(
      { achievementType: "competition" },
      "ar",
      {
        focusType: "competition",
        focusRaw: "bebras",
        scopedLabelAr: "بيبراس",
      }
    );
    expect(label).toBe("بيبراس");
  });
});
