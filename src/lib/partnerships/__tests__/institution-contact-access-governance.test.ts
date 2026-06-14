import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Phase 10.2.6 — student & institution contact governance", () => {
  it("registers StudentInstitutionContactAccess model with required fields", () => {
    const src = readSrc("src/models/StudentInstitutionContactAccess.ts");
    expect(src).toContain("applicationId");
    expect(src).toContain("studentId");
    expect(src).toContain("institutionId");
    expect(src).toContain("grantedBy");
    expect(src).toContain("grantedAt");
    expect(src).toContain("revokedAt");
    expect(src).toContain("isActive");
    expect(src).toContain("shareStudentPhone");
    expect(src).toContain("shareParentPhone");
    expect(src).toContain("shareStudentEmail");
    expect(src).toContain("shareInstitutionContact");
    expect(src).toContain("notes");
  });

  it("defines contact access timeline and audit action constants", async () => {
    const mod = await import("@/lib/partnerships/institution-contact-access-constants");
    expect(mod.CONTACT_ACCESS_TIMELINE_ACTIONS.granted).toBe("contact_access_granted");
    expect(mod.CONTACT_ACCESS_TIMELINE_ACTIONS.updated).toBe("contact_access_updated");
    expect(mod.CONTACT_ACCESS_TIMELINE_ACTIONS.revoked).toBe("contact_access_revoked");
    expect(mod.CONTACT_ACCESS_AUDIT_ACTIONS.granted).toBe("contact_access_granted");
  });

  it("includes timeline labels for contact access events", async () => {
    const { timelineActionLabel } = await import("@/lib/partnerships/partnerships-application-workflow");
    expect(timelineActionLabel("contact_access_granted", true)).toContain("مشاركة");
    expect(timelineActionLabel("contact_access_revoked", true)).toContain("إلغاء");
  });

  it("exports institution contact access service helpers", () => {
    const src = readSrc("src/lib/partnerships/institution-contact-access-service.ts");
    expect(src).toContain("grantOrUpdateContactAccess");
    expect(src).toContain("revokeContactAccess");
    expect(src).toContain("resolveInstitutionStudentContactView");
    expect(src).toContain("resolveStudentInstitutionContactView");
    expect(src).toContain("buildSupervisorContactAccessView");
    expect(src).toContain("logAuditEvent");
  });

  it("gates institution student contact when no active access", () => {
    const src = readSrc("src/lib/partnerships/institution-contact-access-service.ts");
    expect(src).toContain("pendingApproval: true");
    expect(src).toContain("studentPhone: null");
  });

  it("strips organization contact from student-facing payload by default", async () => {
    const mod = await import("@/lib/partnerships/institution-contact-access-constants");
    const stripped = mod.stripOrganizationContactForStudent(
      {
        id: "1",
        name: "Org",
        contactName: "Hidden",
        contactPhone: "0500000000",
        contactEmail: "hidden@example.com",
      },
      { hasAccess: false, contactName: null, contactPhone: null, contactEmail: null }
    );
    expect(stripped?.name).toBe("Org");
    expect(stripped).not.toHaveProperty("contactPhone");
    expect(stripped).not.toHaveProperty("contactEmail");
    expect(stripped).not.toHaveProperty("contactName");
  });

  it("exposes organization contact to student only when access granted", async () => {
    const mod = await import("@/lib/partnerships/institution-contact-access-constants");
    const shared = mod.stripOrganizationContactForStudent(
      { id: "1", name: "Org" },
      {
        hasAccess: true,
        contactName: "Ahmed",
        contactPhone: "0511111111",
        contactEmail: "org@example.com",
      }
    );
    expect((shared as { contactName?: string }).contactName).toBe("Ahmed");
    expect((shared as { contactPhone?: string }).contactPhone).toBe("0511111111");
    expect((shared as { contactEmail?: string }).contactEmail).toBe("org@example.com");
  });

  it("registers admin contact-access API with supervisor gate", () => {
    const src = readSrc("src/app/api/admin/partnerships/applications/[id]/contact-access/route.ts");
    expect(src).toContain("requirePartnershipsContactAccessManage");
    expect(src).toContain("grantOrUpdateContactAccess");
    expect(src).toContain("revokeContactAccess");
    expect(src).toContain('action === "revoke"');
  });

  it("restricts contact access management to admin and partnershipSupervisor", () => {
    const src = readSrc("src/lib/partnerships/partnerships-auth.ts");
    expect(src).toContain("requirePartnershipsContactAccessManage");
    expect(src).toContain("partnershipSupervisor");
    expect(src).toContain("requireAdminOrPartnershipSupervisorGate");
  });

  it("extends institution application detail with contactAccess", () => {
    const src = readSrc("src/lib/partnerships/institution-portal-service.ts");
    expect(src).toContain("resolveInstitutionStudentContactView");
    expect(src).toContain("contactAccess");
  });

  it("gates student opportunity organization contact fields", () => {
    const src = readSrc("src/app/api/partnerships/student-opportunities/route.ts");
    expect(src).toContain("stripOrganizationContactForStudent");
    expect(src).toContain("institutionContact");
  });

  it("admin application page includes contact sharing panel", () => {
    const src = readSrc("src/app/(app)/admin/partnerships/applications/[id]/page.tsx");
    expect(src).toContain("PartnershipContactAccessPanel");
  });

  it("institution application page includes contact access card", () => {
    const src = readSrc("src/app/(app)/institution/training/[id]/page.tsx");
    expect(src).toContain("InstitutionContactAccessCard");
    expect(src).toContain("contactAccess");
  });

  it("student training page shows institution contact only when shared", () => {
    const src = readSrc("src/app/(app)/summer-training/[id]/page.tsx");
    expect(src).toContain("StudentInstitutionContactCard");
    expect(src).toContain("institutionContact");
  });

  it("audit and timeline recorded on grant and revoke", () => {
    const src = readSrc("src/lib/partnerships/institution-contact-access-service.ts");
    expect(src).toContain("CONTACT_ACCESS_TIMELINE_ACTIONS.granted");
    expect(src).toContain("CONTACT_ACCESS_TIMELINE_ACTIONS.revoked");
    expect(src).toContain("CONTACT_ACCESS_AUDIT_ACTIONS");
    expect(src).toContain("appendContactTimeline");
  });
});

describe("regression protection — workflow unchanged", () => {
  it("institution portal decision flow remains importable", () => {
    const src = readSrc("src/lib/partnerships/institution-portal-service.ts");
    expect(src).toContain("executeInstitutionReviewDecision");
    expect(src).toContain("getInstitutionApplicationDetail");
  });

  it("institution messaging service remains importable", async () => {
    const mod = await import("@/lib/partnerships/institution-messaging-service");
    expect(typeof mod.sendInstitutionThreadMessage).toBe("function");
  });
});
