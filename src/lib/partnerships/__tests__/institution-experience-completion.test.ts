import { describe, expect, it, vi } from "vitest";
import { ADMIN_MANAGEABLE_ROLES } from "@/lib/admin-users-constants";
import { ROLE_OPTIONS_FOR_FORM } from "@/lib/admin-users-ui-labels";
import { getPostLoginDestination } from "@/lib/auth-default-route";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

describe("institution experience completion", () => {
  it("exposes trainingInstitution in admin manageable roles", () => {
    expect(ADMIN_MANAGEABLE_ROLES).toContain("trainingInstitution");
  });

  it("shows Arabic label for training institution role in user form", () => {
    const row = ROLE_OPTIONS_FOR_FORM.find((item) => item.value === "trainingInstitution");
    expect(row?.ar).toBe("مسؤول مؤسسة التدريب");
  });

  it("routes trainingInstitution users to institution portal", () => {
    expect(getPostLoginDestination({ role: "trainingInstitution" })).toBe("/institution/training");
  });

  it("exports institution scope helpers", async () => {
    const mod = await import("@/lib/partnerships/institution-scope");
    expect(typeof mod.assertInstitutionApplicationAccess).toBe("function");
    expect(typeof mod.resolveInstitutionApplicationScope).toBe("function");
  });

  it("exports institution experience service helpers", async () => {
    const mod = await import("@/lib/partnerships/institution-experience-service");
    expect(typeof mod.createApplicationRequirement).toBe("function");
    expect(typeof mod.scheduleTrainingInterview).toBe("function");
    expect(typeof mod.createTrainingAssessment).toBe("function");
    expect(typeof mod.submitInstitutionCompletionEvaluation).toBe("function");
    expect(typeof mod.linkInstitutionUserToOrganization).toBe("function");
  });

  it("exports institution messaging service helpers", async () => {
    const mod = await import("@/lib/partnerships/institution-messaging-service");
    expect(typeof mod.listInstitutionThreads).toBe("function");
    expect(typeof mod.listInstitutionMessagingCenter).toBe("function");
    expect(typeof mod.sendInstitutionThreadMessage).toBe("function");
    expect(typeof mod.sendInstitutionSupervisorMessage).toBe("function");
  });

  it("exports institution student profile summary builder", async () => {
    const mod = await import("@/lib/partnerships/institution-student-profile-service");
    expect(typeof mod.buildInstitutionStudentProfileSummary).toBe("function");
  });

  it("registers new institution experience models", async () => {
    const [req, interview, assessment] = await Promise.all([
      import("@/models/ApplicationRequirement"),
      import("@/models/TrainingInterview"),
      import("@/models/TrainingAssessment"),
    ]);
    expect(req.default).toBeTruthy();
    expect(interview.default).toBeTruthy();
    expect(assessment.default).toBeTruthy();
  });

  it("extends institution decision statuses additively", async () => {
    const mod = await import("@/lib/partnerships/partnerships-messaging-constants");
    expect(mod.INSTITUTION_DECISION_STATUSES).toContain("institution_training_evaluated");
  });

  it("includes institution timeline action labels", async () => {
    const { timelineActionLabel } = await import("@/lib/partnerships/partnerships-application-workflow");
    expect(timelineActionLabel("institution_requirement_created", true)).toContain("مستند");
    expect(timelineActionLabel("institution_interview_scheduled", true)).toContain("مقابلة");
    expect(timelineActionLabel("institution_training_evaluated", true)).toContain("تقييم");
  });
});

describe("regression protection — protected engines untouched", () => {
  it("achievement scoring module remains importable", async () => {
    const mod = await import("@/lib/achievement-scoring");
    expect(mod).toBeTruthy();
  });

  it("academic year resolver remains importable", async () => {
    const mod = await import("@/lib/academic-years/current-academic-year");
    expect(typeof mod.getCurrentAcademicYear).toBe("function");
  });

  it("training completion service source remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/training-completion-service.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });
});
