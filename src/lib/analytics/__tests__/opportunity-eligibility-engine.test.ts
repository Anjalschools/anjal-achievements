import { describe, expect, it } from "vitest";
import {
  buildStudentAcademicContext,
  evaluateEligibilityByKey,
} from "@/lib/analytics/ai/opportunity-intelligence/eligibility-engine";
import { matchStudentToAllCompetitions } from "@/lib/analytics/ai/opportunity-intelligence/opportunity-matching-engine";
import { buildStudentOpportunityProfile } from "@/lib/analytics/ai/opportunity-intelligence/ai-decision-engine";

describe("opportunity-eligibility-engine", () => {
  it("blocks nasmo for primary student", () => {
    const student = buildStudentAcademicContext({
      participantId: "s1",
      grade: "g5",
      section: "arabic",
      stageKey: "primary",
    });
    const ev = evaluateEligibilityByKey(student, "nasmo");
    expect(ev?.blocked).toBe(true);
  });

  it("blocks qiyas for middle school student", () => {
    const student = buildStudentAcademicContext({
      participantId: "s2",
      grade: "g8",
      section: "arabic",
      stageKey: "middle",
    });
    const ev = evaluateEligibilityByKey(student, "qiyas");
    expect(ev?.blocked).toBe(true);
  });

  it("recommends kaust path for strong middle math student", () => {
    const student = buildStudentAcademicContext({
      participantId: "s3",
      grade: "g8",
      section: "arabic",
      stageKey: "middle",
      signals: {
        activityKeys: ["kangaroo"],
        participationCount: 4,
        medalCount: 2,
        goldCount: 1,
        mathStrength: 70,
        tags: ["math"],
      },
    });
    const verdicts = matchStudentToAllCompetitions(student);
    const kaust = verdicts.find((v) => v.competitionKey === "kaust_math");
    const qiyas = verdicts.find((v) => v.competitionKey === "qiyas");
    expect(kaust?.decision).not.toBe("BLOCKED");
    expect(qiyas?.decision).toBe("BLOCKED");
    expect(
      verdicts.some(
        (v) =>
          (v.competitionKey === "kaust_math" || v.competitionKey === "ibdaa") &&
          (v.decision === "RECOMMENDED" || v.decision === "HIGH_POTENTIAL" || v.decision === "ELIGIBLE")
      )
    ).toBe(true);
  });

  it("builds student opportunity profile with pathways", () => {
    const student = buildStudentAcademicContext({
      participantId: "s4",
      grade: "g8",
      section: "international",
      stageKey: "middle",
      studyAbroadIntent: true,
      signals: {
        activityKeys: ["ielts"],
        languageStrength: 60,
        tags: ["language", "international_track"],
      },
    });
    const profile = buildStudentOpportunityProfile(student);
    expect(profile.pathwayRecommendations.length).toBeGreaterThan(0);
    expect(profile.blockedCompetitions.some((b) => b.competitionKey === "misk")).toBe(true);
  });
});
