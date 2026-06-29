import { describe, expect, it } from "vitest";

import { isInstitutionalRecordProtectedStudent } from "@/lib/portfolio/portfolio-alumni-protection";
import { isStudentDeleteLocked } from "@/lib/achievementWorkflow";

describe("institutional alumni record protection", () => {
  it("protects alumni account type", () => {
    expect(isInstitutionalRecordProtectedStudent({ accountType: "alumni" })).toBe(true);
  });

  it("protects graduated, transferred, and alumni lifecycle statuses", () => {
    expect(isInstitutionalRecordProtectedStudent({ studentLifecycleStatus: "graduated" })).toBe(true);
    expect(isInstitutionalRecordProtectedStudent({ studentLifecycleStatus: "transferred" })).toBe(true);
    expect(isInstitutionalRecordProtectedStudent({ studentLifecycleStatus: "alumni" })).toBe(true);
    expect(isInstitutionalRecordProtectedStudent({ studentLifecycleStatus: "active" })).toBe(false);
  });

  it("locks achievement deletion for protected student owners", () => {
    expect(
      isStudentDeleteLocked({
        status: "pending",
        ownerStudentLifecycleStatus: "graduated",
      })
    ).toBe(true);
    expect(
      isStudentDeleteLocked({
        status: "pending",
        ownerAccountType: "alumni",
      })
    ).toBe(true);
    expect(
      isStudentDeleteLocked({
        status: "pending",
        ownerStudentLifecycleStatus: "active",
      })
    ).toBe(false);
  });

  it("still locks approved achievements for active students", () => {
    expect(
      isStudentDeleteLocked({
        status: "approved",
        ownerStudentLifecycleStatus: "active",
      })
    ).toBe(true);
  });
});
