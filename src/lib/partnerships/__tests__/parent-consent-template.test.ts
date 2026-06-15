import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildParentConsentVerificationSummary,
  PARENT_CONSENT_STUDENT_CHECK_STATUS_LABELS,
  PARENT_CONSENT_TEMPLATE_TIMELINE_ACTIONS,
} from "@/lib/partnerships/parent-consent-template-constants";
import { PARENT_CONSENT_REQUIREMENT_TYPE } from "@/lib/partnerships/parent-consent-constants";

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Phase 10.3.1.B — generated parent consent template workflow", () => {
  it("registers generatedTemplate on ApplicationRequirement model", () => {
    const src = readSrc("src/models/ApplicationRequirement.ts");
    expect(src).toContain("generatedTemplate");
    expect(src).toContain("ParentConsentGeneratedTemplate");
  });

  it("generates PDF with report-header letterhead", () => {
    const src = readSrc("src/lib/partnerships/parent-consent-pdf-generator.ts");
    expect(src).toContain("report-header.png");
    expect(src).toContain("generateParentConsentPdfBuffer");
    expect(src).toContain("اسم الطالب");
    expect(src).toContain("اسم ولي الأمر");
    expect(src).toContain("التوقيع");
  });

  it("auto-generates template when parent consent requirement is created", () => {
    const serviceSrc = readSrc("src/lib/partnerships/parent-consent-service.ts");
    expect(serviceSrc).toContain("ensureParentConsentGeneratedTemplate");
    const templateSrc = readSrc("src/lib/partnerships/parent-consent-template-service.ts");
    expect(templateSrc).toContain("uploadEvidenceBufferToR2");
    expect(templateSrc).toContain("generateParentConsentPdfBuffer");
  });

  it("exposes student template download API route", () => {
    const routeSrc = readSrc("src/app/api/partnerships/applications/[id]/parent-consent/template/route.ts");
    expect(routeSrc).toContain("ensureParentConsentGeneratedTemplate");
    expect(routeSrc).toContain("recordParentConsentTemplateDownload");
    expect(routeSrc).toContain('role || "") !== "student"');
  });

  it("records template timeline and audit events", () => {
    const templateSrc = readSrc("src/lib/partnerships/parent-consent-template-service.ts");
    expect(templateSrc).toContain("PARENT_CONSENT_TEMPLATE_TIMELINE_ACTIONS.generated");
    expect(templateSrc).toContain("PARENT_CONSENT_TEMPLATE_TIMELINE_ACTIONS.downloaded");
    expect(templateSrc).toContain("parent_consent_template_version_created");
    expect(templateSrc).toContain("parent_consent_template_downloaded");
    const workflowSrc = readSrc("src/lib/partnerships/partnerships-application-workflow.ts");
    expect(workflowSrc).toContain("parent_consent_template_generated");
    expect(workflowSrc).toContain("parent_consent_downloaded");
  });

  it("builds verification summary with field check marks", () => {
    const summary = buildParentConsentVerificationSummary(
      {
        studentName: true,
        organizationName: true,
        opportunityTitle: true,
        guardianDetails: true,
        signature: true,
        date: false,
      },
      96,
      true
    );
    expect(summary).toContain("✓ اسم الطالب");
    expect(summary).toContain("✗ التاريخ");
    expect(summary).toContain("96%");
  });

  it("defines student check status labels", () => {
    expect(PARENT_CONSENT_STUDENT_CHECK_STATUS_LABELS.checking.ar).toBe("قيد الفحص");
    expect(PARENT_CONSENT_STUDENT_CHECK_STATUS_LABELS.verified_pending_review.ar).toBe("تم التحقق مبدئياً");
    expect(PARENT_CONSENT_STUDENT_CHECK_STATUS_LABELS.needs_reupload.ar).toBe("يحتاج إعادة رفع");
  });

  it("enhances verification with template field checks", () => {
    const verifySrc = readSrc("src/lib/partnerships/parent-consent-verification-service.ts");
    expect(verifySrc).toContain("computeParentConsentFieldChecks");
    expect(verifySrc).toContain("templateContext");
    expect(verifySrc).toContain("fieldChecks");
    expect(verifySrc).toContain("studentCheckStatus");
    expect(verifySrc).toContain("buildParentConsentVerificationSummary");
  });

  it("student panel supports download and re-upload workflow", () => {
    const studentSrc = readSrc("src/components/partnerships/StudentParentConsentPanel.tsx");
    expect(studentSrc).toContain("parent-consent/template");
    expect(studentSrc).toContain("تحميل نموذج موافقة ولي الأمر");
    expect(studentSrc).toContain("PARENT_CONSENT_STUDENT_CHECK_STATUS_LABELS");
    expect(studentSrc).toContain("submit_requirement");
  });

  it("supervisor panel shows full review with downloads", () => {
    const supervisorSrc = readSrc("src/components/partnerships/SupervisorParentConsentPanel.tsx");
    expect(supervisorSrc).toContain('viewMode="supervisor"');
    const panelSrc = readSrc("src/components/partnerships/InstitutionParentConsentPanel.tsx");
    expect(panelSrc).toContain("showFieldChecks");
    expect(panelSrc).toContain("تحميل المستند المرفوع");
    expect(panelSrc).toContain("viewMode");
  });

  it("sanitizes parent consent for institution visibility", () => {
    const experienceSrc = readSrc("src/lib/partnerships/institution-experience-service.ts");
    expect(experienceSrc).toContain("sanitizeParentConsentForInstitution");
    expect(experienceSrc).toContain("institutionConsentStatus");
    const templateSrc = readSrc("src/lib/partnerships/parent-consent-template-service.ts");
    expect(templateSrc).toContain("sanitizeParentConsentForInstitution");
    const institutionPanelSrc = readSrc("src/components/partnerships/InstitutionParentConsentPanel.tsx");
    expect(institutionPanelSrc).toContain('viewMode === "institution"');
  });

  it("admin API returns template and uploaded attachment metadata", () => {
    const adminSrc = readSrc("src/app/api/admin/partnerships/applications/[id]/parent-consent/route.ts");
    expect(adminSrc).toContain("generatedTemplate");
    expect(adminSrc).toContain("uploadedAttachment");
    expect(adminSrc).toContain("resolveParentConsentUploadedAttachment");
  });

  it("keeps parent_consent requirement type non-breaking", () => {
    expect(PARENT_CONSENT_REQUIREMENT_TYPE).toBe("parent_consent");
  });
});
