import { describe, expect, it } from "vitest";
import {
  INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  inferInstitutionReportSourceFromMime,
  recommendationToLegacyRating,
} from "@/lib/partnerships/institution-final-report-constants";
import { applyInstitutionExtractionToRecord, mergeSupervisorDefaults } from "@/lib/partnerships/institution-final-report-auto-populate";
import type { InstitutionFinalReportExtractionResult } from "@/lib/partnerships/institution-final-report-constants";

const highConfidenceExtraction = (): InstitutionFinalReportExtractionResult => ({
  supervisorName: "مشرف التدريب",
  contactNumber: "0501234567",
  positionTitle: "مشرف مباشر",
  attendanceRating: 5,
  disciplineRating: 4,
  ethicsRating: 5,
  communicationRating: 4,
  teamworkRating: 5,
  initiativeRating: 4,
  technicalSkillsRating: 5,
  problemSolvingRating: 4,
  taskExecutionRating: 5,
  safetyRating: 5,
  assignedTasks: "أرشفة الملفات ومتابعة المراسلات",
  achievements: "إنجاز مشروع أرشفة رقمي",
  strengths: "التزام ودقة",
  improvementAreas: "المزيد من المهام الميدانية",
  recommendation: "recommended",
  confidenceScore: INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  hasSignature: true,
  hasStamp: true,
  extractionMethod: "hybrid",
});

describe("phase T.2.1 — institution report fallback", () => {
  it("maps recommendation to legacy rating without changing scale", () => {
    expect(recommendationToLegacyRating("strongly_recommended")).toBe(5);
    expect(recommendationToLegacyRating("recommended")).toBe(4);
    expect(recommendationToLegacyRating("not_recommended")).toBe(2);
  });

  it("infers upload source from mime type", () => {
    expect(inferInstitutionReportSourceFromMime("report.pdf", "application/pdf")).toBe("uploaded_pdf");
    expect(inferInstitutionReportSourceFromMime("scan.jpg", "image/jpeg")).toBe("uploaded_scan");
  });

  it("prefills supervisor defaults from institution records when empty", () => {
    const defaults = mergeSupervisorDefaults({
      organizationContactName: "أحمد المشرف",
      organizationContactPhone: "0500000000",
    });
    expect(defaults.supervisorName).toBe("أحمد المشرف");
    expect(defaults.supervisorPhone).toBe("0500000000");
  });

  it("does not override existing supervisor defaults", () => {
    const defaults = mergeSupervisorDefaults({
      existingName: "محمد",
      organizationContactName: "أحمد",
    });
    expect(defaults.supervisorName).toBe("محمد");
  });

  it("auto-populates only empty record fields when confidence is high", () => {
    const record: Record<string, unknown> = {
      supervisorName: "موجود مسبقاً",
    };
    const result = applyInstitutionExtractionToRecord(
      record as Parameters<typeof applyInstitutionExtractionToRecord>[0],
      highConfidenceExtraction(),
      "uploaded_pdf"
    );
    expect(result.applied).toBe(true);
    expect(record.supervisorName).toBe("موجود مسبقاً");
    expect(record.supervisorPhone).toBe("0501234567");
    expect(record.attendanceCommitment).toBe(5);
    expect(record.institutionReportSource).toBe("uploaded_pdf");
    expect(result.skippedFields).toContain("supervisorName");
    expect(result.populatedFields).toContain("supervisorPhone");
  });

  it("skips auto-population when confidence is below threshold", () => {
    const record: Record<string, unknown> = {};
    const extraction = { ...highConfidenceExtraction(), confidenceScore: 40 };
    const result = applyInstitutionExtractionToRecord(
      record as Parameters<typeof applyInstitutionExtractionToRecord>[0],
      extraction,
      "uploaded_scan"
    );
    expect(result.applied).toBe(false);
    expect(record.supervisorName).toBeUndefined();
    expect(record.institutionReportExtraction).toBeDefined();
  });

  it("never overwrites portal institution report source", () => {
    const record: Record<string, unknown> = { institutionReportSource: "portal" };
    applyInstitutionExtractionToRecord(
      record as Parameters<typeof applyInstitutionExtractionToRecord>[0],
      highConfidenceExtraction(),
      "uploaded_pdf"
    );
    expect(record.institutionReportSource).toBe("portal");
  });
});
