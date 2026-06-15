import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  adjustVerificationScoreForTemplateVersion,
  buildTemplateDataHash,
  compareTemplateSnapshots,
  PARENT_CONSENT_TEMPLATE_VERSION_STATUS_LABELS,
  PARENT_CONSENT_TEMPLATE_VERSION_TIMELINE_ACTIONS,
  resolveTemplateVersionStatus,
  validateParentConsentTemplateVersion,
  type ParentConsentTemplateSnapshot,
} from "@/lib/partnerships/parent-consent-template-version";

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const baseSnapshot = (): ParentConsentTemplateSnapshot => ({
  organizationName: "مؤسسة التدريب",
  opportunityTitle: "تدريب صيفي",
  trainingStartDate: "2026-06-01",
  trainingEndDate: "2026-06-30",
  trainingHours: 40,
  academicYear: "2025-2026",
});

describe("Phase 10.3.1.C — parent consent template versioning", () => {
  it("stores version metadata on generated template type", () => {
    const src = readSrc("src/lib/partnerships/parent-consent-template-constants.ts");
    expect(src).toContain("templateVersion");
    expect(src).toContain("templateGeneratedAt");
    expect(src).toContain("templateFingerprint");
    expect(src).toContain("templateDataHash");
    expect(src).toContain("templateSnapshot");
  });

  it("creates stable templateDataHash from snapshot fields", () => {
    const hashA = buildTemplateDataHash(baseSnapshot());
    const hashB = buildTemplateDataHash(baseSnapshot());
    expect(hashA).toHaveLength(64);
    expect(hashA).toBe(hashB);
  });

  it("detects no change scenario as current", () => {
    const validation = validateParentConsentTemplateVersion({
      templateSnapshot: baseSnapshot(),
      currentSnapshot: baseSnapshot(),
      templateVersion: 1,
      templateDataHash: buildTemplateDataHash(baseSnapshot()),
      verificationScore: 95,
    });
    expect(validation.status).toBe("current");
    expect(validation.scoreAdjusted).toBe(false);
    expect(validation.adjustedScore).toBe(95);
    expect(validation.staleDetected).toBe(false);
  });

  it("detects minor name formatting changes", () => {
    const template = baseSnapshot();
    const current = {
      ...baseSnapshot(),
      opportunityTitle: "تدريب صيفي للطلاب",
    };
    const comparisons = compareTemplateSnapshots(template, current);
    const status = resolveTemplateVersionStatus(comparisons);
    expect(status).toBe("minor_changes");
  });

  it("detects outdated scenario for substantive training changes", () => {
    const validation = validateParentConsentTemplateVersion({
      templateSnapshot: baseSnapshot(),
      currentSnapshot: {
        ...baseSnapshot(),
        trainingHours: 80,
        trainingEndDate: "2026-07-15",
      },
      templateVersion: 1,
      templateDataHash: buildTemplateDataHash(baseSnapshot()),
      verificationScore: 95,
    });
    expect(validation.status).toBe("outdated");
    expect(validation.staleDetected).toBe(true);
    expect(validation.comparisons.some((row) => row.field === "trainingHours")).toBe(true);
  });

  it("adjusts verification score for outdated templates without auto-reject", () => {
    const adjusted = adjustVerificationScoreForTemplateVersion(95, "outdated");
    expect(adjusted.adjustedScore).toBe(75);
    expect(adjusted.scoreAdjusted).toBe(true);
    const unchanged = adjustVerificationScoreForTemplateVersion(95, "minor_changes");
    expect(unchanged.adjustedScore).toBe(95);
  });

  it("wires template version validation into upload verification service", () => {
    const verifySrc = readSrc("src/lib/partnerships/parent-consent-verification-service.ts");
    expect(verifySrc).toContain("validateParentConsentTemplateVersion");
    expect(verifySrc).toContain("templateVersionValidation");
    expect(verifySrc).toContain("parent_consent_template_version_mismatch");
    expect(verifySrc).toContain("PARENT_CONSENT_TEMPLATE_VERSION_TIMELINE_ACTIONS.outdatedDetected");
  });

  it("supports template regeneration with version increment", () => {
    const templateSrc = readSrc("src/lib/partnerships/parent-consent-template-service.ts");
    expect(templateSrc).toContain("regenerateParentConsentTemplate");
    expect(templateSrc).toContain("templateVersionHistory");
    expect(templateSrc).toContain("parent_consent_template_regenerated");
    const adminSrc = readSrc("src/app/api/admin/partnerships/applications/[id]/parent-consent/route.ts");
    expect(adminSrc).toContain("regenerate_template");
  });

  it("exposes supervisor comparison view and student stale feedback", () => {
    const panelSrc = readSrc("src/components/partnerships/ParentConsentVerificationPanel.tsx");
    expect(panelSrc).toContain("حالة النموذج");
    expect(panelSrc).toContain("PARENT_CONSENT_TEMPLATE_VERSION_STATUS_LABELS");
    const studentSrc = readSrc("src/components/partnerships/StudentParentConsentPanel.tsx");
    expect(studentSrc).toContain("PARENT_CONSENT_STALE_TEMPLATE_MESSAGE");
    expect(studentSrc).toContain("templateStaleForOpportunity");
  });

  it("extends analytics with outdated and regeneration metrics", () => {
    const analyticsSrc = readSrc("src/lib/partnerships/parent-consent-service.ts");
    expect(analyticsSrc).toContain("outdatedDetectedCount");
    expect(analyticsSrc).toContain("regeneratedCount");
    expect(analyticsSrc).toContain("templateCompatibilityRate");
    const intelligenceSrc = readSrc("src/lib/partnerships/institution-performance-intelligence-service.ts");
    expect(intelligenceSrc).toContain("templateCompatibilityRate");
  });

  it("defines template version status labels", () => {
    expect(PARENT_CONSENT_TEMPLATE_VERSION_STATUS_LABELS.current.icon).toBe("🟢");
    expect(PARENT_CONSENT_TEMPLATE_VERSION_STATUS_LABELS.minor_changes.icon).toBe("🟡");
    expect(PARENT_CONSENT_TEMPLATE_VERSION_STATUS_LABELS.outdated.icon).toBe("🔴");
    expect(PARENT_CONSENT_TEMPLATE_VERSION_TIMELINE_ACTIONS.outdatedDetected).toBe(
      "parent_consent_template_outdated_detected"
    );
  });
});
