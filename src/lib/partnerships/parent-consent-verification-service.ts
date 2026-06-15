import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit-log-service";
import ApplicationRequirement from "@/models/ApplicationRequirement";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingAttachment from "@/models/TrainingAttachment";
import {
  buildPdfReviewInputs,
  fetchPdfBufferForAchievementReview,
} from "@/lib/achievement-admin-pdf-review";
import { extractLabeledField } from "@/lib/achievement-attachment-ai-guardrails";
import {
  collapseWhitespace,
  compareStudentNameToRecord,
  normalizeDigitsInString,
} from "@/lib/achievement-attachment-normalization";
import { computeDocumentFingerprint } from "@/lib/document-content-fingerprint";
import { openAiChatJsonObjectWithVision, type VisionUserPart } from "@/lib/openai-vision-json";
import {
  PARENT_CONSENT_NEGATIVE_SIGNALS,
  PARENT_CONSENT_POSITIVE_SIGNALS,
  type ParentConsentAiVerification,
  type ParentConsentOcrExtract,
  type ParentConsentVerificationClassification,
  resolveParentConsentConfidenceBand,
} from "@/lib/partnerships/parent-consent-verification-constants";
import {
  buildParentConsentVerificationSummary,
  type ParentConsentFieldChecks,
  type ParentConsentGeneratedTemplate,
  type ParentConsentStudentCheckStatus,
  type ParentConsentTemplateContext,
} from "@/lib/partnerships/parent-consent-template-constants";
import {
  buildParentConsentTemplateSnapshot,
} from "@/lib/partnerships/parent-consent-template-service";
import {
  PARENT_CONSENT_TEMPLATE_VERSION_TIMELINE_ACTIONS,
  validateParentConsentTemplateVersion,
} from "@/lib/partnerships/parent-consent-template-version";
import {
  PARENT_CONSENT_REQUIREMENT_TYPE,
  PARENT_CONSENT_TIMELINE_ACTIONS,
} from "@/lib/partnerships/parent-consent-constants";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";

const DEBUG = process.env.AI_DEBUG === "1";

const isPdfFile = (fileName: string, mimeType?: string): boolean => {
  const name = fileName.toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  return name.endsWith(".pdf") || mime.includes("pdf");
};

const isImageFile = (fileName: string, mimeType?: string): boolean => {
  const name = fileName.toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  return mime.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(name);
};

const fetchRemoteBuffer = async (url: string): Promise<{ buffer: Buffer } | { error: string }> => {
  if (isPdfFile(url)) return fetchPdfBufferForAchievementReview(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return { error: `http_${res.status}` };
    const ab = await res.arrayBuffer();
    if (ab.byteLength > 8 * 1024 * 1024) return { error: "file_too_large" };
    return { buffer: Buffer.from(ab) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
};

const extractParentConsentOcrFields = (text: string): ParentConsentOcrExtract => {
  const raw = normalizeDigitsInString(String(text || ""));
  const flat = collapseWhitespace(raw);

  const extractedName =
    extractLabeledField(raw, [
      /(?:اسم\s*ولي\s*الأمر|اسم\s*الوصي|اسم\s*الطالب|parent\s*name|guardian\s*name|student\s*name)\s*[:：]?\s*(.+)/i,
    ]) || null;

  const extractedDate =
    extractLabeledField(raw, [
      /(?:التاريخ|تاريخ\s*التوقيع|date)\s*[:：]?\s*(.+)/i,
    ]) ||
    (flat.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/)?.[1] ?? null);

  const extractedIdNumber =
    extractLabeledField(raw, [
      /(?:رقم\s*الهوية|الهوية\s*الوطنية|national\s*id|id\s*number)\s*[:：]?\s*(.+)/i,
    ]) ||
    (flat.match(/\b[12]\d{9}\b/)?.[0] ?? null);

  const signatureHint =
    extractLabeledField(raw, [
      /(?:التوقيع|توقيع\s*ولي\s*الأمر|signature)\s*[:：]?\s*(.+)/i,
    ]) ||
    (/توقيع|signature/i.test(raw) ? "detected" : null);

  const letterCount = (raw.match(/[\u0600-\u06FFa-zA-Z]/g) || []).length;
  const ocrReliability: ParentConsentOcrExtract["ocrReliability"] =
    letterCount >= 120 ? "high" : letterCount >= 40 ? "medium" : "low";

  return {
    rawText: raw.slice(0, 12_000),
    extractedName,
    extractedDate,
    extractedIdNumber,
    signatureHint,
    ocrReliability,
  };
};

const detectKeywordSignals = (text: string) => {
  const lower = text.toLowerCase();
  const positiveSignals = PARENT_CONSENT_POSITIVE_SIGNALS.filter((kw) =>
    lower.includes(kw.toLowerCase())
  );
  const negativeSignals = PARENT_CONSENT_NEGATIVE_SIGNALS.filter((kw) =>
    lower.includes(kw.toLowerCase())
  );
  return { positiveSignals: [...positiveSignals], negativeSignals: [...negativeSignals] };
};

const textContainsField = (haystack: string, needle: string): boolean => {
  const h = collapseWhitespace(normalizeDigitsInString(haystack)).toLowerCase();
  const n = collapseWhitespace(normalizeDigitsInString(needle)).toLowerCase();
  if (!n || n.length < 2) return false;
  if (h.includes(n)) return true;
  const tokens = n.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => h.includes(t)).length;
  return matched >= Math.min(2, tokens.length);
};

const computeParentConsentFieldChecks = (input: {
  ocr: ParentConsentOcrExtract;
  templateContext?: ParentConsentTemplateContext | null;
  studentName: string;
}): ParentConsentFieldChecks => {
  const raw = input.ocr.rawText;
  const ctx = input.templateContext;
  const studentTarget = ctx?.studentName || input.studentName;

  const studentName =
    (studentTarget
      ? textContainsField(raw, studentTarget) ||
        compareStudentNameToRecord({ detected: raw, systemNames: [studentTarget] }).strength !== "none"
      : false) ||
    Boolean(input.ocr.extractedName);

  const organizationName = ctx?.organizationName
    ? textContainsField(raw, ctx.organizationName)
    : /مؤسسة|organization|training/i.test(raw);

  const opportunityTitle = ctx?.opportunityTitle
    ? textContainsField(raw, ctx.opportunityTitle)
    : /فرصة|opportunity|تدريب|training/i.test(raw);

  const guardianDetails =
    Boolean(input.ocr.extractedName || input.ocr.extractedIdNumber) ||
    /ولي\s*الأمر|ولي\s*الامر|guardian|parent|الوصي|صلة\s*القرابة|جوال|mobile/i.test(raw);

  const signature = Boolean(input.ocr.signatureHint) || /توقيع|signature/i.test(raw);
  const date = Boolean(input.ocr.extractedDate) || /\b20\d{2}[-/.]\d{1,2}/.test(raw);

  return { studentName, organizationName, opportunityTitle, guardianDetails, signature, date };
};

const resolveStudentCheckStatus = (input: {
  fieldChecks: ParentConsentFieldChecks;
  verificationScore: number;
  classification: ParentConsentVerificationClassification;
  duplicateDetected: boolean;
}): ParentConsentStudentCheckStatus => {
  const passedCount = Object.values(input.fieldChecks).filter(Boolean).length;
  if (input.duplicateDetected || input.verificationScore < 45 || input.classification === "unlikely_parent_consent") {
    return "needs_reupload";
  }
  if (input.verificationScore >= 70 && passedCount >= 4) {
    return "verified_pending_review";
  }
  if (passedCount >= 3 && input.verificationScore >= 55) {
    return "verified_pending_review";
  }
  if (input.verificationScore < 55 || passedCount < 3) {
    return "needs_reupload";
  }
  return "verified_pending_review";
};

const scoreParentConsentDocument = (input: {
  ocr: ParentConsentOcrExtract;
  positiveSignals: string[];
  negativeSignals: string[];
  studentName: string;
  duplicateDetected: boolean;
  aiScore?: number | null;
}): number => {
  let score = 20;

  if (input.ocr.rawText.length >= 80) score += 10;
  if (input.ocr.rawText.length >= 200) score += 10;
  if (input.ocr.ocrReliability === "high") score += 10;
  if (input.ocr.ocrReliability === "medium") score += 5;

  score += Math.min(30, input.positiveSignals.length * 6);
  score -= Math.min(40, input.negativeSignals.length * 12);

  if (input.ocr.signatureHint) score += 12;
  if (input.ocr.extractedName) score += 8;
  if (input.ocr.extractedDate) score += 6;
  if (input.ocr.extractedIdNumber) score += 6;

  if (input.studentName && input.ocr.rawText) {
    const nameMatch = compareStudentNameToRecord({
      detected: input.ocr.rawText,
      systemNames: [input.studentName],
    });
    if (nameMatch.strength === "strong") score += 15;
    else if (nameMatch.strength === "weak") score += 8;
  }

  if (input.duplicateDetected) score -= 35;
  if (input.ocr.rawText.length < 25) score -= 25;

  if (typeof input.aiScore === "number" && Number.isFinite(input.aiScore)) {
    score = Math.round(score * 0.55 + input.aiScore * 0.45);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

const classifyParentConsent = (score: number, negativeCount: number): ParentConsentVerificationClassification => {
  if (negativeCount >= 2 && score < 80) return "unlikely_parent_consent";
  if (score >= 75) return "likely_parent_consent";
  if (score >= 45) return "unclear";
  return "unlikely_parent_consent";
};

const runVisionParentConsentAssist = async (input: {
  imageUrls: string[];
  studentName: string;
  extractedText: string;
}): Promise<{ score: number; summaryAr: string; summaryEn: string } | null> => {
  if (input.imageUrls.length === 0) return null;

  const visionParts: VisionUserPart[] = input.imageUrls.slice(0, 2).map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "low" as const },
  }));

  const result = await openAiChatJsonObjectWithVision({
    system:
      "You verify whether an uploaded document is a parent/guardian consent form for student training. Reply JSON only with keys: isParentConsent (boolean), confidenceScore (0-100 number), summaryAr (string), summaryEn (string), detectedSignals (string[]).",
    userParts: [
      {
        type: "text",
        text: `Student name: ${input.studentName || "unknown"}\nExtracted OCR text:\n${input.extractedText.slice(0, 4000)}`,
      },
      ...visionParts,
    ],
    maxTokens: 500,
    temperature: 0.1,
  });

  if (!result.ok || !result.parsed || typeof result.parsed !== "object") return null;
  const row = result.parsed as Record<string, unknown>;
  const score = Number(row.confidenceScore);
  if (!Number.isFinite(score)) return null;
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    summaryAr: String(row.summaryAr || "").trim(),
    summaryEn: String(row.summaryEn || "").trim(),
  };
};

export const findDuplicateParentConsentFingerprint = async (input: {
  fingerprint: string;
  excludeRequirementId?: string;
}): Promise<boolean> => {
  if (!input.fingerprint) return false;
  await connectDB();
  const query: Record<string, unknown> = {
    requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
    "aiVerification.documentFingerprint": input.fingerprint,
  };
  if (input.excludeRequirementId && mongoose.Types.ObjectId.isValid(input.excludeRequirementId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(input.excludeRequirementId) };
  }
  const existing = await ApplicationRequirement.findOne(query).select("_id").lean();
  return Boolean(existing);
};

export const runParentConsentAiVerification = async (input: {
  requirementId: string;
  attachmentId: string;
  storageKey: string;
  fileName: string;
  mimeType?: string;
  studentName?: string;
  applicationId: string;
  templateContext?: ParentConsentTemplateContext | null;
  generatedTemplate?: ParentConsentGeneratedTemplate | null;
}): Promise<ParentConsentAiVerification> => {
  const verifiedAt = new Date().toISOString();
  const studentName = String(input.studentName || "").trim();

  const fetched = await fetchRemoteBuffer(input.storageKey);
  if ("error" in fetched) {
    return {
      verificationScore: 0,
      confidenceBand: "reviewer_alert",
      classification: "unclear",
      positiveSignals: [],
      negativeSignals: ["fetch_failed"],
      summaryAr: "تعذر قراءة الملف للتحقق الآلي.",
      summaryEn: "Could not read the file for automated verification.",
      verifiedAt,
      duplicateDetected: false,
      documentFingerprint: computeDocumentFingerprint({ storageKey: input.storageKey }),
      ocr: {
        rawText: "",
        extractedName: null,
        extractedDate: null,
        extractedIdNumber: null,
        signatureHint: null,
        ocrReliability: "low",
      },
      runStatus: "failed",
    };
  }

  const fingerprint = computeDocumentFingerprint({ buffer: fetched.buffer });
  const duplicateDetected = await findDuplicateParentConsentFingerprint({
    fingerprint,
    excludeRequirementId: input.requirementId,
  });

  let rawText = "";
  const imageUrls: string[] = [];

  if (isPdfFile(input.fileName, input.mimeType)) {
    const slice = await buildPdfReviewInputs(fetched.buffer, input.fileName);
    rawText = slice.text;
    imageUrls.push(...slice.images);
  } else if (isImageFile(input.fileName, input.mimeType)) {
    const mime = (input.mimeType || "image/jpeg").toLowerCase();
    const dataUrl = `data:${mime};base64,${fetched.buffer.toString("base64")}`;
    if (dataUrl.length <= 1_800_000) imageUrls.push(dataUrl);
  }

  const ocr = extractParentConsentOcrFields(rawText);
  const { positiveSignals, negativeSignals } = detectKeywordSignals(ocr.rawText);

  const visionAssist = await runVisionParentConsentAssist({
    imageUrls: imageUrls.length > 0 ? imageUrls : isImageFile(input.fileName, input.mimeType) ? [input.storageKey] : [],
    studentName,
    extractedText: ocr.rawText,
  });

  const verificationScore = scoreParentConsentDocument({
    ocr,
    positiveSignals,
    negativeSignals,
    studentName,
    duplicateDetected,
    aiScore: visionAssist?.score ?? null,
  });

  let finalScore = verificationScore;
  let templateVersionValidation = undefined;

  if (input.generatedTemplate?.templateSnapshot && input.generatedTemplate.templateDataHash) {
    const currentSnapshot = await buildParentConsentTemplateSnapshot(input.applicationId);
    if (currentSnapshot) {
      templateVersionValidation = validateParentConsentTemplateVersion({
        templateSnapshot: input.generatedTemplate.templateSnapshot,
        currentSnapshot,
        templateVersion: input.generatedTemplate.templateVersion || 1,
        templateDataHash: input.generatedTemplate.templateDataHash,
        verificationScore,
      });
      if (templateVersionValidation.scoreAdjusted) {
        finalScore = templateVersionValidation.adjustedScore;
      }
    }
  }

  const classification = classifyParentConsent(finalScore, negativeSignals.length);
  const confidenceBand = resolveParentConsentConfidenceBand(finalScore);

  const fieldChecks = computeParentConsentFieldChecks({
    ocr,
    templateContext: input.templateContext,
    studentName,
  });
  const studentCheckStatus = resolveStudentCheckStatus({
    fieldChecks,
    verificationScore: finalScore,
    classification,
    duplicateDetected,
  });
  const verificationSummary = buildParentConsentVerificationSummary(fieldChecks, finalScore, true);
  const verificationSummaryEn = buildParentConsentVerificationSummary(fieldChecks, finalScore, false);

  const staleSuffixAr =
    templateVersionValidation?.staleDetected
      ? "\n\nتنبيه: النموذج أقدم من بيانات الفرصة الحالية."
      : "";
  const staleSuffixEn =
    templateVersionValidation?.staleDetected
      ? "\n\nAlert: template is older than current opportunity data."
      : "";

  const summaryAr =
    visionAssist?.summaryAr ||
    (classification === "likely_parent_consent"
      ? `موافقة ولي أمر محتملة\n\nدرجة الثقة: ${finalScore}%${templateVersionValidation?.scoreAdjusted ? ` (قبل التعديل: ${verificationScore}%)` : ""}\n\nتم العثور على:\n${verificationSummary}${staleSuffixAr}`
      : classification === "unlikely_parent_consent"
        ? `المستند لا يبدو موافقة ولي أمر. درجة الثقة: ${finalScore}%${staleSuffixAr}`
        : `يتطلب مراجعة بشرية. درجة الثقة: ${finalScore}%${staleSuffixAr}`);

  const summaryEn =
    visionAssist?.summaryEn ||
    (classification === "likely_parent_consent"
      ? `Likely parent/guardian consent\n\nConfidence: ${finalScore}%${templateVersionValidation?.scoreAdjusted ? ` (before adjustment: ${verificationScore}%)` : ""}\n\nFound:\n${verificationSummaryEn}${staleSuffixEn}`
      : classification === "unlikely_parent_consent"
        ? `Document does not appear to be parent consent. Confidence: ${finalScore}%${staleSuffixEn}`
        : `Requires human review. Confidence: ${finalScore}%${staleSuffixEn}`);

  const payload: ParentConsentAiVerification = {
    verificationScore: finalScore,
    confidenceBand,
    classification,
    positiveSignals,
    negativeSignals,
    summaryAr,
    summaryEn,
    verificationSummary,
    verifiedAt,
    duplicateDetected,
    documentFingerprint: fingerprint,
    ocr,
    fieldChecks,
    studentCheckStatus,
    templateVersionValidation,
    runStatus: "completed",
    aiAssisted: Boolean(visionAssist),
  };

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[PARENT_CONSENT_AI]", {
      requirementId: input.requirementId,
      score: finalScore,
      classification,
      duplicateDetected,
      templateVersionStatus: templateVersionValidation?.status,
    });
  }

  return payload;
};

const recordTemplateVersionMismatch = async (input: {
  requirementId: string;
  applicationId: string;
  actorId?: string;
  validation: NonNullable<ParentConsentAiVerification["templateVersionValidation"]>;
}) => {
  if (input.validation.status === "current") return;

  if (input.validation.status === "outdated") {
    const application = await StudentTrainingApplication.findById(input.applicationId);
    if (application) {
      application.timeline = appendTimelineEvent(application.timeline, {
        at: new Date(),
        action: PARENT_CONSENT_TEMPLATE_VERSION_TIMELINE_ACTIONS.outdatedDetected,
        actorId: input.actorId,
        note: input.validation.status,
      });
      await application.save();
    }
  }

  await logAuditEvent({
    actionType: "parent_consent_template_version_mismatch",
    entityType: "ApplicationRequirement",
    entityId: input.requirementId,
    entityTitle: "موافقة ولي الأمر",
    descriptionAr:
      input.validation.status === "outdated"
        ? "اكتشاف نموذج موافقة قديم مقارنة ببيانات الفرصة الحالية"
        : "اكتشاف اختلافات بسيطة في نموذج الموافقة",
    actor: input.actorId && mongoose.Types.ObjectId.isValid(input.actorId)
      ? { id: new mongoose.Types.ObjectId(input.actorId), role: "student" }
      : { name: "system", role: "system" },
    metadata: {
      applicationId: input.applicationId,
      requirementId: input.requirementId,
      templateVersion: input.validation.templateVersion,
      status: input.validation.status,
      originalScore: input.validation.originalScore,
      adjustedScore: input.validation.adjustedScore,
    },
  });
};

export const persistParentConsentVerification = async (input: {
  requirementId: string;
  attachmentId: string;
  verification: ParentConsentAiVerification;
  actorId?: string;
}) => {
  await connectDB();
  const requirement = await ApplicationRequirement.findById(input.requirementId);
  if (!requirement) return;

  requirement.set("aiVerification", input.verification);
  requirement.set("documentFingerprint", input.verification.documentFingerprint);
  await requirement.save();

  await TrainingAttachment.findByIdAndUpdate(input.attachmentId, {
    $set: {
      contentFingerprint: input.verification.documentFingerprint,
      storageProvider: "r2",
    },
  });

  const application = await StudentTrainingApplication.findById(requirement.applicationId);
  if (application) {
    application.timeline = appendTimelineEvent(application.timeline, {
      at: new Date(),
      action: PARENT_CONSENT_TIMELINE_ACTIONS.aiVerified,
      actorId: input.actorId,
      note: `${input.verification.verificationScore}%`,
    });
    await application.save();
  }
};

export const verifyParentConsentAfterUpload = async (input: {
  requirementId: string;
  attachmentId: string;
  storageKey: string;
  fileName: string;
  mimeType?: string;
  applicationId: string;
  studentName?: string;
  actorId?: string;
}) => {
  await connectDB();
  const requirement = await ApplicationRequirement.findById(input.requirementId).lean();
  const generatedTemplate =
    (requirement?.generatedTemplate as ParentConsentGeneratedTemplate | undefined) ?? null;
  const templateContext = generatedTemplate?.context ?? null;

  const verification = await runParentConsentAiVerification({
    ...input,
    templateContext,
    generatedTemplate,
  });
  await persistParentConsentVerification({
    requirementId: input.requirementId,
    attachmentId: input.attachmentId,
    verification,
    actorId: input.actorId,
  });
  if (verification.templateVersionValidation) {
    await recordTemplateVersionMismatch({
      requirementId: input.requirementId,
      applicationId: input.applicationId,
      actorId: input.actorId,
      validation: verification.templateVersionValidation,
    });
  }
  return verification;
};
