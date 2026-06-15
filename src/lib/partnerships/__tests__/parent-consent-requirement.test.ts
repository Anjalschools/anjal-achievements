import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapRequirementToParentConsentDisplay,
  PARENT_CONSENT_ACCEPTANCE_BLOCKED_AR,
  PARENT_CONSENT_DEFAULT_DESCRIPTION,
  PARENT_CONSENT_DEFAULT_TITLE,
  PARENT_CONSENT_REQUIREMENT_TYPE,
  PARENT_CONSENT_REVIEW_PENDING_AR,
  PARENT_CONSENT_TIMELINE_ACTIONS,
  isParentConsentFileAllowed,
} from "@/lib/partnerships/parent-consent-constants";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Phase 10.3.1 — parent consent requirement", () => {
  it("registers parent_consent on ApplicationRequirement model", () => {
    const src = readSrc("src/models/ApplicationRequirement.ts");
    expect(src).toContain('requirementType');
    expect(src).toContain("parent_consent");
  });

  it("defines parent consent constants and display statuses", () => {
    expect(PARENT_CONSENT_REQUIREMENT_TYPE).toBe("parent_consent");
    expect(PARENT_CONSENT_DEFAULT_TITLE.ar).toBe("موافقة ولي الأمر");
    expect(PARENT_CONSENT_DEFAULT_DESCRIPTION.ar).toContain("رفع نموذج موافقة ولي الأمر");
    expect(mapRequirementToParentConsentDisplay(null)).toBe("not_required");
    expect(
      mapRequirementToParentConsentDisplay({
        requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
        status: "pending",
      })
    ).toBe("required");
    expect(
      mapRequirementToParentConsentDisplay({
        requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
        status: "submitted",
      })
    ).toBe("uploaded");
    expect(
      mapRequirementToParentConsentDisplay({
        requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
        status: "accepted",
      })
    ).toBe("approved");
    expect(
      mapRequirementToParentConsentDisplay({
        requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
        status: "rejected",
      })
    ).toBe("rejected");
  });

  it("allows only PDF, JPG, and PNG uploads", () => {
    expect(isParentConsentFileAllowed("consent.pdf")).toBe(true);
    expect(isParentConsentFileAllowed("photo.jpg")).toBe(true);
    expect(isParentConsentFileAllowed("scan.PNG")).toBe(true);
    expect(isParentConsentFileAllowed("notes.docx")).toBe(false);
    expect(isParentConsentFileAllowed("file.bin", "application/pdf")).toBe(true);
  });

  it("exports parent consent service helpers", () => {
    const src = readSrc("src/lib/partnerships/parent-consent-service.ts");
    expect(src).toContain("createParentConsentRequirement");
    expect(src).toContain("assertParentConsentAllowsFinalAcceptance");
    expect(src).toContain("reviewParentConsentRequirement");
    expect(src).toContain("notifyParentConsentUploaded");
    expect(src).toContain("buildParentConsentAnalytics");
  });

  it("blocks final acceptance when parent consent is missing or pending review", async () => {
    const ApplicationRequirement = (await import("@/models/ApplicationRequirement")).default;
    const findOneSpy = vi.spyOn(ApplicationRequirement, "findOne");

    findOneSpy.mockReturnValueOnce({
      lean: vi.fn(async () => ({
        requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
        required: true,
        status: "pending",
      })),
    } as never);
    const { assertParentConsentAllowsFinalAcceptance } = await import(
      "@/lib/partnerships/parent-consent-service"
    );
    const missing = await assertParentConsentAllowsFinalAcceptance("app-1");
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error).toBe(PARENT_CONSENT_ACCEPTANCE_BLOCKED_AR);
      expect(missing.code).toBe("parent_consent_missing");
    }

    findOneSpy.mockReturnValueOnce({
      lean: vi.fn(async () => ({
        requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
        required: true,
        status: "submitted",
      })),
    } as never);
    const pendingReview = await assertParentConsentAllowsFinalAcceptance("app-1");
    expect(pendingReview.ok).toBe(false);
    if (!pendingReview.ok) {
      expect(pendingReview.error).toBe(PARENT_CONSENT_REVIEW_PENDING_AR);
      expect(pendingReview.code).toBe("parent_consent_review_pending");
    }

    findOneSpy.mockReturnValueOnce({
      lean: vi.fn(async () => ({
        requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
        required: true,
        status: "accepted",
      })),
    } as never);
    const allowed = await assertParentConsentAllowsFinalAcceptance("app-1");
    expect(allowed.ok).toBe(true);

    findOneSpy.mockRestore();
  });

  it("wires acceptance gate into institution and supervisor transitions", () => {
    const institutionSrc = readSrc("src/lib/partnerships/institution-portal-service.ts");
    const supervisorSrc = readSrc("src/lib/partnerships/partnerships-supervisor-transition-service.ts");
    expect(institutionSrc).toContain("assertParentConsentAllowsFinalAcceptance");
    expect(supervisorSrc).toContain("assertParentConsentAllowsFinalAcceptance");
  });

  it("includes parent consent in pipeline, timeline, notifications, and analytics", () => {
    const pipelineSrc = readSrc("src/lib/partnerships/institution-candidate-pipeline-service.ts");
    const workflowSrc = readSrc("src/lib/partnerships/partnerships-application-workflow.ts");
    const experienceSrc = readSrc("src/lib/partnerships/institution-experience-service.ts");
    const intelligenceSrc = readSrc("src/lib/partnerships/institution-performance-intelligence-service.ts");

    expect(pipelineSrc).toContain("parentConsentStatus");
    expect(pipelineSrc).toContain("PARENT_CONSENT_REQUIREMENT_TYPE");
    expect(workflowSrc).toContain(PARENT_CONSENT_TIMELINE_ACTIONS.requested);
    expect(workflowSrc).toContain(PARENT_CONSENT_TIMELINE_ACTIONS.uploaded);
    expect(workflowSrc).toContain(PARENT_CONSENT_TIMELINE_ACTIONS.approved);
    expect(workflowSrc).toContain(PARENT_CONSENT_TIMELINE_ACTIONS.rejected);
    expect(experienceSrc).toContain("reviewApplicationRequirement");
    expect(experienceSrc).toContain("createParentConsentRequirement");
    expect(intelligenceSrc).toContain("parentConsentAnalytics");
    expect(intelligenceSrc).toContain("buildParentConsentAnalytics");
  });

  it("exposes student upload and review APIs", () => {
    const institutionTasksSrc = readSrc("src/app/api/partnerships/applications/[id]/institution-tasks/route.ts");
    const institutionActionsSrc = readSrc("src/app/api/institution/training/applications/[id]/actions/route.ts");
    const adminParentConsentSrc = readSrc(
      "src/app/api/admin/partnerships/applications/[id]/parent-consent/route.ts"
    );

    expect(institutionTasksSrc).toContain("submit_requirement");
    expect(institutionActionsSrc).toContain("create_parent_consent");
    expect(institutionActionsSrc).toContain("review_requirement");
    expect(adminParentConsentSrc).toContain("createParentConsentRequirement");
    expect(adminParentConsentSrc).toContain("reviewApplicationRequirement");
  });

  it("renders student and institution parent consent UI", () => {
    expect(readSrc("src/components/partnerships/StudentParentConsentPanel.tsx")).toContain(
      "submit_requirement"
    );
    expect(readSrc("src/components/partnerships/InstitutionParentConsentPanel.tsx")).toContain(
      "create_parent_consent"
    );
    expect(readSrc("src/components/partnerships/ParentConsentStatusBadge.tsx")).toContain(
      "ParentConsentDisplayStatus"
    );
  });
});
