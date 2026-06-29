import { describe, expect, it, vi } from "vitest";
import { validateApplicationTransition } from "@/lib/partnerships/partnerships-state-machine";
import {
  getOrganizationInstitutionUserId,
  organizationHasInstitutionAccount,
} from "@/lib/partnerships/institution-organization-resolver";
import { INSTITUTION_FINAL_RECOMMENDATIONS } from "@/lib/partnerships/institution-experience-constants";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

describe("institution account governance", () => {
  it("uses institutionUserId as canonical source of truth", () => {
    const userId = "507f1f77bcf86cd799439011";
    expect(
      getOrganizationInstitutionUserId({
        institutionUserId: userId as unknown as import("mongoose").Types.ObjectId,
        institutionUserIds: [],
      })
    ).toBe(userId);
  });

  it("falls back to first legacy institutionUserIds entry", () => {
    const legacy = "507f1f77bcf86cd799439012";
    expect(
      getOrganizationInstitutionUserId({
        institutionUserIds: [legacy as unknown as import("mongoose").Types.ObjectId],
      })
    ).toBe(legacy);
  });

  it("detects when organization already has institution account", () => {
    expect(
      organizationHasInstitutionAccount({
        institutionUserId: "507f1f77bcf86cd799439011" as unknown as import("mongoose").Types.ObjectId,
      })
    ).toBe(true);
    expect(organizationHasInstitutionAccount({ institutionUserIds: [] })).toBe(false);
  });

  it("exports institution account service helpers", async () => {
    const mod = await import("@/lib/partnerships/institution-account-service");
    expect(typeof mod.createInstitutionAccount).toBe("function");
    expect(typeof mod.resetInstitutionAccountPassword).toBe("function");
    expect(typeof mod.setInstitutionAccountStatus).toBe("function");
    expect(typeof mod.resendInstitutionLoginCredentials).toBe("function");
  });
});

describe("final evaluation and school approval workflow", () => {
  it("allows accepted → awaiting_school_approval transition", () => {
    const result = validateApplicationTransition("accepted", "awaiting_school_approval");
    expect(result.ok).toBe(true);
  });

  it("blocks institution evaluation transition from non-accepted statuses", () => {
    const result = validateApplicationTransition("institution_review", "awaiting_school_approval");
    expect(result.ok).toBe(false);
  });

  it("includes new final recommendation scale", () => {
    expect(INSTITUTION_FINAL_RECOMMENDATIONS).toContain("excellent");
    expect(INSTITUTION_FINAL_RECOMMENDATIONS).toContain("very_good");
    expect(INSTITUTION_FINAL_RECOMMENDATIONS).toContain("not_recommended");
  });

  it("exports school approval service helpers", async () => {
    const mod = await import("@/lib/partnerships/institution-school-approval-service");
    expect(typeof mod.approveInstitutionEvaluationForSchool).toBe("function");
    expect(typeof mod.rejectInstitutionEvaluationForSchool).toBe("function");
  });

  it("allows automation completion from awaiting_school_approval", async () => {
    const { canAutomationCompleteApplication } = await import("@/lib/partnerships/partnerships-state-machine");
    expect(canAutomationCompleteApplication("awaiting_school_approval")).toBe(true);
  });
});

describe("regression protection — protected engines untouched", () => {
  it("training achievement automation remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/training-achievement-automation.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });

  it("training completion review service remains present", async () => {
    const mod = await import("@/lib/partnerships/training-completion-service");
    expect(typeof mod.reviewTrainingCompletionReport).toBe("function");
  });

  it("academic year resolver remains importable", async () => {
    const mod = await import("@/lib/academic-years/current-academic-year");
    expect(typeof mod.getCurrentAcademicYear).toBe("function");
  });

  it("career profile service source remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/career/student-career-profile-service.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });
});
