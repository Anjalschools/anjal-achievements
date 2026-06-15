import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeBufferContentFingerprint,
  computeDocumentFingerprint,
} from "@/lib/document-content-fingerprint";
import {
  PARENT_CONSENT_NEGATIVE_SIGNALS,
  PARENT_CONSENT_POSITIVE_SIGNALS,
  resolveParentConsentConfidenceBand,
} from "@/lib/partnerships/parent-consent-verification-constants";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));
vi.mock("@/models/ApplicationRequirement", () => ({
  default: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => null),
      })),
    })),
    findById: vi.fn(async () => null),
    findByIdAndUpdate: vi.fn(async () => null),
  },
}));
vi.mock("@/models/StudentTrainingApplication", () => ({
  default: { findById: vi.fn(async () => null) },
}));
vi.mock("@/models/TrainingAttachment", () => ({
  default: { findByIdAndUpdate: vi.fn(async () => null) },
}));
vi.mock("@/lib/openai-vision-json", () => ({
  openAiChatJsonObjectWithVision: vi.fn(async () => ({ ok: false, code: "config", message: "skip" })),
}));

const consentPdfText =
  "نموذج موافقة ولي الأمر\nاسم الطالب: أحمد محمد\nأوافق على مشاركة ابني في التدريب الصيفي\nالتوقيع: ولي الأمر\nالتاريخ: 2026-06-01";

vi.mock("@/lib/achievement-admin-pdf-review", () => ({
  buildPdfReviewInputs: vi.fn(async () => ({
    text: consentPdfText,
    images: [],
    hints: [],
    textReliability: { lowTextReliability: false, letterCount: 200, reasons: [] },
    lowPdfTextReliability: false,
  })),
  fetchPdfBufferForAchievementReview: vi.fn(async () => ({ buffer: Buffer.from("pdf") })),
}));

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Phase 10.3.1.A — parent consent AI verification", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => Buffer.from("pdf-bytes"),
      })) as unknown as typeof fetch
    );
  });

  it("computes stable document fingerprints from buffer and storage key", () => {
    const buffer = Buffer.from("parent-consent-sample");
    const fromBuffer = computeBufferContentFingerprint(buffer);
    const fromKey = computeDocumentFingerprint({ storageKey: "https://cdn.example.com/evidence/consent.pdf" });
    expect(fromBuffer).toHaveLength(64);
    expect(fromKey.length).toBeGreaterThan(4);
    expect(computeDocumentFingerprint({ buffer })).toBe(fromBuffer);
  });

  it("defines confidence bands at 90 and 70 thresholds", () => {
    expect(resolveParentConsentConfidenceBand(95)).toBe("very_trusted");
    expect(resolveParentConsentConfidenceBand(80)).toBe("needs_human_review");
    expect(resolveParentConsentConfidenceBand(55)).toBe("reviewer_alert");
  });

  it("registers aiVerification metadata on ApplicationRequirement", () => {
    const src = readSrc("src/models/ApplicationRequirement.ts");
    expect(src).toContain("aiVerification");
    expect(src).toContain("documentFingerprint");
  });

  it("registers attachment metadata for evidence storage reuse", () => {
    const src = readSrc("src/models/TrainingAttachment.ts");
    expect(src).toContain("contentFingerprint");
    expect(src).toContain("storageProvider");
    expect(src).toContain("mimeType");
  });

  it("reuses achievement OCR and vision verification stack", () => {
    const src = readSrc("src/lib/partnerships/parent-consent-verification-service.ts");
    expect(src).toContain("buildPdfReviewInputs");
    expect(src).toContain("fetchPdfBufferForAchievementReview");
    expect(src).toContain("extractLabeledField");
    expect(src).toContain("openAiChatJsonObjectWithVision");
    expect(src).toContain("computeDocumentFingerprint");
  });

  it("routes parent consent uploads through achievement attachment storage", () => {
    const uploadSrc = readSrc("src/lib/partnerships/training-completion-upload.ts");
    const studentSrc = readSrc("src/components/partnerships/StudentParentConsentPanel.tsx");
    expect(uploadSrc).toContain("uploadParentConsentEvidenceFile");
    expect(uploadSrc).toContain('storageProvider: "r2"');
    expect(studentSrc).toContain("uploadParentConsentEvidenceFile");
    expect(readSrc("src/lib/partnerships/training-completion-upload.ts")).toContain("/api/uploads/attachment");
  });

  it("runs verification after parent consent upload", () => {
    const src = readSrc("src/lib/partnerships/institution-experience-service.ts");
    expect(src).toContain("verifyParentConsentAfterUpload");
  });

  it("includes ai verification timeline action and analytics", () => {
    expect(PARENT_CONSENT_POSITIVE_SIGNALS).toContain("موافقة");
    expect(PARENT_CONSENT_NEGATIVE_SIGNALS).toContain("فاتورة");
    const workflowSrc = readSrc("src/lib/partnerships/partnerships-application-workflow.ts");
    const analyticsSrc = readSrc("src/lib/partnerships/parent-consent-service.ts");
    expect(workflowSrc).toContain("parent_consent_ai_verified");
    expect(analyticsSrc).toContain("suspiciousCount");
    expect(analyticsSrc).toContain("avgConfidenceScore");
  });

  it("renders verification review UI for institution reviewers", () => {
    const panelSrc = readSrc("src/components/partnerships/ParentConsentVerificationPanel.tsx");
    const institutionSrc = readSrc("src/components/partnerships/InstitutionParentConsentPanel.tsx");
    expect(panelSrc).toContain("verificationScore");
    expect(panelSrc).toContain("ocr.rawText");
    expect(institutionSrc).toContain("ParentConsentVerificationPanel");
  });

  it("scores PDF parent consent documents from OCR signals", async () => {
    const { runParentConsentAiVerification } = await import(
      "@/lib/partnerships/parent-consent-verification-service"
    );

    const result = await runParentConsentAiVerification({
      requirementId: "req-1",
      attachmentId: "att-1",
      storageKey: "https://example.com/consent.pdf",
      fileName: "consent.pdf",
      mimeType: "application/pdf",
      applicationId: "app-1",
      studentName: "أحمد محمد",
    });

    expect(result.verificationScore).toBeGreaterThanOrEqual(70);
    expect(result.classification).not.toBe("unlikely_parent_consent");
    expect(result.ocr.rawText).toContain("موافقة");
    expect(result.runStatus).toBe("completed");
    expect(result.documentFingerprint).toHaveLength(64);
  });
});
