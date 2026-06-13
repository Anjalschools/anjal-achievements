import { describe, expect, it } from "vitest";
import { validateApplicationTransition } from "@/lib/partnerships/partnerships-state-machine";
import {
  canSupervisorApproveApplication,
  resolveSupervisorTransitionSteps,
  supervisorApprovalBlockedReason,
} from "@/lib/partnerships/partnerships-application-workflow";
import { academicYearLabelFromDate } from "@/lib/academic-year";

describe("partnerships workflow hardening", () => {
  it("blocks direct submitted → institution_review in state machine", () => {
    const result = validateApplicationTransition("submitted", "institution_review");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Invalid transition");
    }
  });

  it("chains submitted → institution_review through under_review for send-to-institution", () => {
    expect(resolveSupervisorTransitionSteps("submitted", "institution_review")).toEqual([
      "under_review",
      "institution_review",
    ]);
  });

  it("keeps single-step transitions for under_review → institution_review", () => {
    expect(resolveSupervisorTransitionSteps("under_review", "institution_review")).toEqual([
      "institution_review",
    ]);
  });

  it("allows approval only from institution_review", () => {
    expect(canSupervisorApproveApplication("institution_review")).toBe(true);
    expect(canSupervisorApproveApplication("submitted")).toBe(false);
    expect(canSupervisorApproveApplication("under_review")).toBe(false);
  });

  it("returns Arabic approval guard message before institution review", () => {
    expect(supervisorApprovalBlockedReason("submitted", true)).toContain("إرسال الطلب للمؤسسة");
    expect(supervisorApprovalBlockedReason("under_review", true)).toContain("إرسال الطلب للمؤسسة");
  });

  it("derives academic year label from date as last-resort fallback", () => {
    const label = academicYearLabelFromDate(new Date("2025-09-01"));
    expect(label).toMatch(/2025\/2026/);
  });
});

describe("regression protection — stable subsystem exports", () => {
  it("training achievement automation source remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/training-achievement-automation.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });

  it("training completion service source remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/training-completion-service.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });

  it("achievement engine scoring module remains importable", async () => {
    const mod = await import("@/lib/achievement-scoring");
    expect(mod).toBeTruthy();
  });
});
