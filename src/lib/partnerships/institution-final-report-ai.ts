import "server-only";
import {
  extractPdfTextForAchievementReview,
  fetchPdfBufferForAchievementReview,
} from "@/lib/achievement-admin-pdf-review";
import { collapseWhitespace } from "@/lib/achievement-attachment-normalization";
import { openAiChatJsonObjectWithVision, type VisionUserPart } from "@/lib/openai-vision-json";
import type {
  InstitutionFinalReportExtractionResult,
  InstitutionFinalReportRecommendation,
} from "@/lib/partnerships/institution-final-report-constants";
import { validateInstitutionFinalReport } from "@/lib/partnerships/institution-final-report-validation";
import {
  verifyInstitutionReportVisually,
  visionRatingValue,
} from "@/lib/partnerships/institution-final-report-vision-verification";
import type { InstitutionReportVisionVerification } from "@/lib/partnerships/institution-final-report-vision-shared";

const DEBUG = process.env.AI_DEBUG === "1";

const RATING_KEYS = [
  "attendanceRating",
  "disciplineRating",
  "ethicsRating",
  "communicationRating",
  "teamworkRating",
  "initiativeRating",
  "technicalSkillsRating",
  "problemSolvingRating",
  "taskExecutionRating",
  "safetyRating",
] as const;

const isPdf = (fileName: string, mimeType?: string) => {
  const name = fileName.toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  return name.endsWith(".pdf") || mime.includes("pdf");
};

const isImage = (fileName: string, mimeType?: string) => {
  const name = fileName.toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  return mime.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(name);
};

const clampRating = (value: unknown): number | undefined => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return undefined;
  return n;
};

const parseRecommendation = (value: unknown): InstitutionFinalReportRecommendation | undefined => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return undefined;
  if (raw.includes("strong") || raw.includes("بشدة") || raw.includes("strongly")) {
    return "strongly_recommended";
  }
  if (raw.includes("not") || raw.includes("غير")) return "not_recommended";
  if (raw.includes("recommend") || raw.includes("موصى")) return "recommended";
  return undefined;
};

const heuristicExtractFromText = (text: string): Partial<InstitutionFinalReportExtractionResult> => {
  const flat = collapseWhitespace(text);
  const withoutStampLabel = flat.replace(/الختم الرسمي للمؤسسة/g, " ");
  const hasSignature = /توقيع[\s:：]*[^\n_\s—\-]{4,}/i.test(flat);
  const hasStamp =
    /(?:مختوم|official seal|institution stamp)/i.test(withoutStampLabel) ||
    /ختم[\s:：]+[^\n]{4,}/i.test(withoutStampLabel);

  const ratingFromLabel = (label: string) => {
    const re = new RegExp(`${label}[^\\d]{0,30}(\\d)`, "i");
    const m = flat.match(re);
    return m ? clampRating(m[1]) : undefined;
  };

  return {
    supervisorName: flat.match(/(?:اسم\s*المشرف|المشرف\s*المباشر)\s*[:：]?\s*([^\n|،,]{2,80})/i)?.[1]?.trim(),
    contactNumber:
      flat.match(/(?:رقم\s*التواصل|الهاتف|جوال)\s*[:：]?\s*([+\d\s-]{8,20})/i)?.[1]?.trim() ||
      flat.match(/\b05\d{8}\b/)?.[0],
    positionTitle: flat.match(/(?:المسمى\s*الوظيفي|المنصب)\s*[:：]?\s*([^\n|،,]{2,80})/i)?.[1]?.trim(),
    attendanceRating: ratingFromLabel("الالتزام بالحضور"),
    disciplineRating: ratingFromLabel("الانضباط المهني"),
    ethicsRating: ratingFromLabel("الأخلاقيات المهنية"),
    communicationRating: ratingFromLabel("التواصل"),
    teamworkRating: ratingFromLabel("العمل الجماعي"),
    initiativeRating: ratingFromLabel("المبادرة"),
    technicalSkillsRating: ratingFromLabel("المهارات التقنية"),
    problemSolvingRating: ratingFromLabel("حل المشكلات"),
    taskExecutionRating: ratingFromLabel("جودة تنفيذ المهام"),
    safetyRating: ratingFromLabel("اتباع أنظمة السلامة"),
    assignedTasks: flat.match(/(?:المهام\s*المسندة)\s*[:：]?\s*([\s\S]{10,800}?)(?=أبرز|نقاط|فرص|التوصية|$)/i)?.[1]?.trim(),
    achievements: flat.match(/(?:أبرز\s*الإنجازات)\s*[:：]?\s*([\s\S]{10,800}?)(?=نقاط|فرص|التوصية|$)/i)?.[1]?.trim(),
    strengths: flat.match(/(?:نقاط\s*القوة)\s*[:：]?\s*([\s\S]{10,800}?)(?=فرص|التوصية|$)/i)?.[1]?.trim(),
    improvementAreas: flat.match(/(?:فرص\s*التحسين)\s*[:：]?\s*([\s\S]{10,800}?)(?=التوصية|$)/i)?.[1]?.trim(),
    recommendation: parseRecommendation(
      flat.match(/(?:التوصية|موصى)\s*[:：]?\s*([^\n]{3,60})/i)?.[1]
    ),
    hasSignature,
    hasStamp,
  };
};

const buildVisionDataUrl = (buffer: Buffer, mimeType: string) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const visionExtract = async (
  buffer: Buffer,
  mimeType: string,
  ocrPreview: string
): Promise<Partial<InstitutionFinalReportExtractionResult> | null> => {
  const system = `You extract structured training institution final report fields from Arabic documents.
Return JSON only with keys:
supervisorName, contactNumber, positionTitle,
attendanceRating, disciplineRating, ethicsRating, communicationRating, teamworkRating, initiativeRating,
technicalSkillsRating, problemSolvingRating, taskExecutionRating, safetyRating (integers 1-5 when visible),
assignedTasks, achievements, strengths, improvementAreas (strings),
recommendation ("strongly_recommended"|"recommended"|"not_recommended"),
hasSignature (boolean), hasStamp (boolean), confidenceScore (0-100 integer).
Use null for missing fields. Do not invent data.`;

  const userParts: VisionUserPart[] = [
    {
      type: "text",
      text: `OCR preview:\n${ocrPreview.slice(0, 4000)}\n\nExtract institution final evaluation fields.`,
    },
    { type: "image_url", image_url: { url: buildVisionDataUrl(buffer, mimeType), detail: "auto" } },
  ];

  const result = await openAiChatJsonObjectWithVision({ system, userParts, maxTokens: 1800 });
  if (!result.ok || !result.parsed || typeof result.parsed !== "object") return null;

  const row = result.parsed as Record<string, unknown>;
  return {
    supervisorName: String(row.supervisorName || "").trim() || undefined,
    contactNumber: String(row.contactNumber || "").trim() || undefined,
    positionTitle: String(row.positionTitle || "").trim() || undefined,
    attendanceRating: clampRating(row.attendanceRating),
    disciplineRating: clampRating(row.disciplineRating),
    ethicsRating: clampRating(row.ethicsRating),
    communicationRating: clampRating(row.communicationRating),
    teamworkRating: clampRating(row.teamworkRating),
    initiativeRating: clampRating(row.initiativeRating),
    technicalSkillsRating: clampRating(row.technicalSkillsRating),
    problemSolvingRating: clampRating(row.problemSolvingRating),
    taskExecutionRating: clampRating(row.taskExecutionRating),
    safetyRating: clampRating(row.safetyRating),
    assignedTasks: String(row.assignedTasks || "").trim() || undefined,
    achievements: String(row.achievements || "").trim() || undefined,
    strengths: String(row.strengths || "").trim() || undefined,
    improvementAreas: String(row.improvementAreas || "").trim() || undefined,
    recommendation: parseRecommendation(row.recommendation),
    hasSignature: row.hasSignature === true,
    hasStamp: row.hasStamp === true,
    confidenceScore:
      typeof row.confidenceScore === "number"
        ? Math.max(0, Math.min(100, Math.round(row.confidenceScore)))
        : undefined,
  };
};

const scoreExtraction = (fields: Partial<InstitutionFinalReportExtractionResult>): number => {
  const textKeys = ["assignedTasks", "achievements", "strengths", "improvementAreas"] as const;

  let score = 0;
  for (const key of RATING_KEYS) {
    if (fields[key] != null) score += 5;
  }
  for (const key of textKeys) {
    if (String(fields[key] || "").trim().length >= 10) score += 4;
  }
  if (fields.supervisorName) score += 8;
  if (fields.recommendation) score += 8;
  if (fields.hasSignature) score += 6;
  if (fields.hasStamp) score += 6;
  return Math.max(0, Math.min(100, score));
};

const resolveExtractionMethod = (
  hasOcr: boolean,
  hasVisionFields: boolean,
  hasVisionVerification: boolean
): InstitutionFinalReportExtractionResult["extractionMethod"] => {
  if (hasVisionFields || hasVisionVerification) {
    return hasOcr ? "hybrid" : "vision";
  }
  return hasOcr ? "ocr" : "heuristic";
};

const computeOverallConfidence = (
  ocrConfidence: number,
  visionConfidence: number,
  visionVerification: InstitutionReportVisionVerification | null
) => {
  const validVisionRows =
    visionVerification?.ratingRows.filter((row) => row.rowStatus === "VALID").length ?? 0;
  if (visionConfidence > 0) {
    const visionWeight = validVisionRows >= 5 ? 0.72 : 0.55;
    return Math.round(visionConfidence * visionWeight + ocrConfidence * (1 - visionWeight));
  }
  return ocrConfidence;
};

const mergeRating = (
  key: (typeof RATING_KEYS)[number],
  visionVerification: InstitutionReportVisionVerification | null,
  visionFields: Partial<InstitutionFinalReportExtractionResult> | null,
  heuristic: Partial<InstitutionFinalReportExtractionResult>
) => {
  const visionRow = visionVerification?.ratingRows.find((row) => row.key === key);
  const visualRating = visionRatingValue(visionRow);
  if (visualRating != null) return visualRating;
  if (visionFields?.[key] != null) return visionFields[key];
  return heuristic[key];
};

const mergeVisualFlags = (
  visionVerification: InstitutionReportVisionVerification | null,
  visionFields: Partial<InstitutionFinalReportExtractionResult> | null,
  heuristic: Partial<InstitutionFinalReportExtractionResult>
) => {
  const stampFromVision =
    visionVerification &&
    visionVerification.stampConfidence >= 35 &&
    visionVerification.stampDetected;
  const signatureFromVision =
    visionVerification &&
    visionVerification.signatureConfidence >= 35 &&
    visionVerification.signatureDetected;

  return {
    hasStamp: Boolean(stampFromVision ?? visionFields?.hasStamp ?? heuristic.hasStamp),
    hasSignature: Boolean(signatureFromVision ?? visionFields?.hasSignature ?? heuristic.hasSignature),
  };
};

export type ExtractInstitutionFinalReportInput = {
  storageKey: string;
  fileName: string;
  mimeType?: string;
};

export const extractInstitutionFinalReportFromUpload = async (
  input: ExtractInstitutionFinalReportInput
): Promise<InstitutionFinalReportExtractionResult> => {
  let buffer: Buffer | null = null;
  let ocrText = "";

  try {
    if (isPdf(input.fileName, input.mimeType)) {
      const fetched = await fetchPdfBufferForAchievementReview(input.storageKey);
      if ("buffer" in fetched) {
        buffer = fetched.buffer;
        ocrText = (await extractPdfTextForAchievementReview(fetched.buffer)).text || "";
      }
    } else if (isImage(input.fileName, input.mimeType)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 18_000);
      try {
        const res = await fetch(input.storageKey, { signal: ctrl.signal, redirect: "follow" });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          buffer = Buffer.from(ab);
        }
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (e) {
    if (DEBUG) console.warn("[institution-final-report-ai] fetch failed", e);
  }

  const heuristic = heuristicExtractFromText(ocrText);
  let visionFields: Partial<InstitutionFinalReportExtractionResult> | null = null;
  let visionVerification: InstitutionReportVisionVerification | null = null;

  if (buffer) {
    const mime =
      input.mimeType ||
      (isPdf(input.fileName, input.mimeType) ? "application/pdf" : "image/jpeg");
    visionVerification = await verifyInstitutionReportVisually(buffer, mime, ocrText);
    visionFields = await visionExtract(buffer, mime, ocrText);
  }

  const extractionMethod = resolveExtractionMethod(
    Boolean(ocrText.trim()),
    Boolean(visionFields),
    Boolean(visionVerification)
  );

  const visualFlags = mergeVisualFlags(visionVerification, visionFields, heuristic);
  const ocrConfidence = scoreExtraction(heuristic);
  const visionConfidence =
    visionVerification?.visionConfidence ??
    visionFields?.confidenceScore ??
    0;
  const overallConfidence = computeOverallConfidence(ocrConfidence, visionConfidence, visionVerification);

  const merged: InstitutionFinalReportExtractionResult = {
    supervisorName: visionFields?.supervisorName || heuristic.supervisorName,
    contactNumber: visionFields?.contactNumber || heuristic.contactNumber,
    positionTitle: visionFields?.positionTitle || heuristic.positionTitle,
    attendanceRating: mergeRating("attendanceRating", visionVerification, visionFields, heuristic),
    disciplineRating: mergeRating("disciplineRating", visionVerification, visionFields, heuristic),
    ethicsRating: mergeRating("ethicsRating", visionVerification, visionFields, heuristic),
    communicationRating: mergeRating("communicationRating", visionVerification, visionFields, heuristic),
    teamworkRating: mergeRating("teamworkRating", visionVerification, visionFields, heuristic),
    initiativeRating: mergeRating("initiativeRating", visionVerification, visionFields, heuristic),
    technicalSkillsRating: mergeRating(
      "technicalSkillsRating",
      visionVerification,
      visionFields,
      heuristic
    ),
    problemSolvingRating: mergeRating("problemSolvingRating", visionVerification, visionFields, heuristic),
    taskExecutionRating: mergeRating("taskExecutionRating", visionVerification, visionFields, heuristic),
    safetyRating: mergeRating("safetyRating", visionVerification, visionFields, heuristic),
    assignedTasks: visionFields?.assignedTasks || heuristic.assignedTasks,
    achievements: visionFields?.achievements || heuristic.achievements,
    strengths: visionFields?.strengths || heuristic.strengths,
    improvementAreas: visionFields?.improvementAreas || heuristic.improvementAreas,
    recommendation: visionFields?.recommendation || heuristic.recommendation,
    hasSignature: visualFlags.hasSignature,
    hasStamp: visualFlags.hasStamp,
    confidenceScore: overallConfidence,
    ocrConfidence,
    visionConfidence,
    overallConfidence,
    ocrTextPreview: ocrText.slice(0, 2000) || undefined,
    extractionMethod,
    visionVerification: visionVerification ?? undefined,
  };

  const validationResult = validateInstitutionFinalReport(merged, ocrText);

  console.info("[institution-final-report-ai]", {
    extractionMethod: validationResult.extractionMethod,
    ratingsDetected: validationResult.ratingsDetected,
    stampDetected: validationResult.stampDetected,
    signatureDetected: validationResult.signatureDetected,
    ocrConfidence: validationResult.ocrConfidence,
    visionConfidence: validationResult.visionConfidence,
    overallConfidence: validationResult.overallConfidence ?? merged.confidenceScore,
  });

  if (DEBUG) {
    console.info("[institution-final-report-ai:debug]", {
      method: merged.extractionMethod,
      ocrConfidence,
      visionConfidence,
      overallConfidence,
      stampConfidence: validationResult.stampConfidence,
      signatureConfidence: validationResult.signatureConfidence,
    });
  }

  return {
    ...merged,
    validationResult,
  };
};
