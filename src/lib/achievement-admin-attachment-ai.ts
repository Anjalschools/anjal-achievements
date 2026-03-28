/**
 * Admin-only AI review of evidence attachments vs achievement record (advisory).
 */

import type {
  AdminAttachmentAiChecks,
  AdminAttachmentAiExtractedEvidence,
  AdminAttachmentAiReviewResult,
  AdminAttachmentMatchValue,
  AdminAttachmentPerFileReview,
  GroupDocumentAnalysis,
} from "@/types/admin-attachment-ai-review";
import { openAiChatJsonObjectWithVision, type VisionUserPart } from "@/lib/openai-vision-json";
import { resolveAchievementComparableYearFromDoc } from "@/lib/achievement-duplicate";
import {
  guessFileNameFromAttachmentUrl,
  isPdfForAttachmentJob,
  listPdfAttachmentSourceDescriptors,
} from "@/lib/achievement-attachment-pdf-sources";
import {
  buildPdfReviewInputs,
  decodePdfDataUrlToBuffer,
  fetchPdfBufferForAchievementReview,
} from "@/lib/achievement-admin-pdf-review";
import { isPdfAttachmentUrl } from "@/lib/achievement-pdf-url-match";
import {
  applyAttachmentAiGuardrails,
  mergePdfReliability,
  type PdfReliabilityAggregate,
} from "@/lib/achievement-attachment-ai-guardrails";
import { detectAttachmentDocumentKind } from "@/lib/achievement-group-document-detection";
import {
  buildGroupListAttachmentReviewResult,
  shouldUseGroupListAttachmentPipeline,
} from "@/lib/achievement-group-document-review";
import { deriveOverallFromChecks } from "@/lib/achievement-admin-attachment-ai-checks";
import type { AttachmentDocumentKindResult } from "@/lib/achievement-group-document-detection";
import { debugAttachmentAiSnap } from "@/lib/achievement-attachment-ai-pipeline-debug";
import { inferMimeFromUrl } from "@/lib/achievement-attachments";
import { applyDeterministicAttachmentReviewDecision } from "@/lib/attachment-ai-decision-engine";

export { deriveOverallFromChecks } from "@/lib/achievement-admin-attachment-ai-checks";
export type { PdfAttachmentSourceDescriptor } from "@/lib/achievement-attachment-pdf-sources";
export {
  guessFileNameFromAttachmentUrl,
  isPdfForAttachmentJob,
  listPdfAttachmentSourceDescriptors,
} from "@/lib/achievement-attachment-pdf-sources";

/** Exported for the debug CLI; must stay aligned with `runAdminAchievementAttachmentAiReview`. */
export const ADMIN_ATTACHMENT_AI_REVIEW_SYSTEM_PROMPT = `You are an expert document reviewer for a Saudi student achievements platform.
Return ONE JSON object only (no markdown).

Each check must be exactly one of: "match", "mismatch", "unclear".
Rules:
- "match" only if the document clearly supports consistency with the system record (after normalizing Arabic/English and ignoring diacritics).
- "mismatch" ONLY if you can point to an explicit, readable contradiction in the attachment (e.g. a different student name clearly printed, a certificate year that contradicts the recorded year, an event title that clearly refers to something else). Missing text, garbled PDF extraction, bilingual two-column layout, or partial OCR is NOT a contradiction — use "unclear".
- "unclear" whenever evidence is missing, weak, noisy, or ambiguous — strongly prefer "unclear" over "mismatch" when extraction quality is doubtful.
- Never use "mismatch" because a field was not found or text is hard to parse.
- Year: compare calendar year only (ignore day/month differences). Arabic and Western digits are equivalent.
- Level: only "match" if scope is explicit on the certificate; otherwise "unclear". Do not guess international vs national from logos alone.
- resultCheck: compare medal/participation/rank wording in the document with medalType/resultType/rank in the system record when visible.
- If hints mention LOW PDF text reliability, treat all sensitive checks conservatively (prefer "unclear").
- If hints say the PDF looks like a GROUP list / roster / circular / nominee list (many student names, no single certificate), do NOT expect medals or individual certificate wording. Prefer "unclear" over "mismatch" for resultCheck/level when those fields are absent. Use notes to state it is a group document.

JSON shape:
{
  "overallMatchStatus": "match"|"mismatch"|"unclear",
  "checks": {
    "nameCheck": "...",
    "yearCheck": "...",
    "levelCheck": "...",
    "achievementCheck": "...",
    "resultCheck": "..."
  },
  "extractedEvidence": {
    "detectedStudentName": string|null,
    "detectedYear": string|null,
    "detectedLevel": string|null,
    "detectedAchievementTitle": string|null,
    "detectedMedalOrResult": string|null,
    "detectedIssuer": string|null,
    "notesAr": string,
    "notesEn": string
  },
  "recommendationAr": string,
  "recommendationEn": string,
  "modelNote": string
}`;

export const buildAdminAttachmentAiUserText = (input: {
  record: Record<string, unknown>;
  docKindDetection: AttachmentDocumentKindResult;
  textHints: string[];
  visionPartsCount: number;
}): string => {
  const kindHint = `تصنيف أولي آلي للنص المستخرج (قد يكون غير كامل):\n- النوع المقترح: ${input.docKindDetection.kind}\n- الثقة: ${input.docKindDetection.confidence.toFixed(2)}\n- إشارات: ${input.docKindDetection.reasons.slice(0, 12).join(", ") || "—"}\n`;

  const hintBlock =
    input.textHints.length > 0
      ? `\nملاحظات على المرفقات (روابط/أنواع):\n${input.textHints.join("\n")}\n`
      : "";

  return `سجل النظام (JSON):\n${JSON.stringify(input.record)}\n${kindHint}${hintBlock}\n${
    input.visionPartsCount === 0
      ? "لا توجد صور قابلة للتحليل البصري المباشر في هذه الطلبية — إن وُجد نص PDF مستخرج ضمن الملاحظات فاستخدمه بحذر؛ وإلا اجعل الحقول غير المؤكدة unclear."
      : `عدد الصور المرفقة للتحليل البصري: ${input.visionPartsCount}`
  }`;
};

const MAX_IMAGES = 3;
const MAX_DATA_URL_CHARS = 1_800_000;

const normalizeCheck = (v: unknown): AdminAttachmentMatchValue => {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (s === "match" || s === "mismatch" || s === "unclear") return s;
  return "unclear";
};

const pickStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t || null;
};

export const parseAdminAttachmentAiPayload = (parsed: unknown): AdminAttachmentAiReviewResult | null => {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const checksRaw = o.checks;
  if (!checksRaw || typeof checksRaw !== "object") return null;
  const c = checksRaw as Record<string, unknown>;

  const checks: AdminAttachmentAiChecks = {
    nameCheck: normalizeCheck(c.nameCheck),
    yearCheck: normalizeCheck(c.yearCheck),
    levelCheck: normalizeCheck(c.levelCheck),
    achievementCheck: normalizeCheck(c.achievementCheck),
    ...(typeof c.resultCheck === "string"
      ? { resultCheck: normalizeCheck(c.resultCheck) }
      : {}),
  };

  const evRaw = o.extractedEvidence;
  const evObj =
    evRaw && typeof evRaw === "object" ? (evRaw as Record<string, unknown>) : {};

  const extractedEvidence: AdminAttachmentAiExtractedEvidence = {
    detectedStudentName: pickStr(evObj.detectedStudentName),
    detectedYear: pickStr(evObj.detectedYear),
    detectedLevel: pickStr(evObj.detectedLevel),
    detectedAchievementTitle: pickStr(evObj.detectedAchievementTitle),
    detectedMedalOrResult: pickStr(evObj.detectedMedalOrResult) ?? null,
    detectedIssuer: pickStr(evObj.detectedIssuer) ?? null,
    notesAr: pickStr(evObj.notesAr) || "",
    notesEn: pickStr(evObj.notesEn) || "",
  };

  const overallMatchStatus = deriveOverallFromChecks(checks);

  const recommendationAr = pickStr(o.recommendationAr) || "";
  const recommendationEn = pickStr(o.recommendationEn) || "";

  const detectedDocumentKind = pickStr(o.detectedDocumentKind);
  const kindParsed =
    detectedDocumentKind === "individual_certificate" ||
    detectedDocumentKind === "group_list_document" ||
    detectedDocumentKind === "unknown_document"
      ? detectedDocumentKind
      : undefined;

  const groupRaw = o.groupDocumentAnalysis;
  const groupDocumentAnalysis =
    groupRaw && typeof groupRaw === "object" ? (groupRaw as GroupDocumentAnalysis) : undefined;

  return {
    overallMatchStatus,
    checks,
    extractedEvidence,
    recommendationAr,
    recommendationEn,
    analyzedAt: new Date().toISOString(),
    modelNote: pickStr(o.modelNote) || undefined,
    ...(kindParsed ? { detectedDocumentKind: kindParsed } : {}),
    ...(groupDocumentAnalysis ? { groupDocumentAnalysis } : {}),
  };
};

export type AdminAttachmentAiRecordContext = {
  achievement: Record<string, unknown>;
  student: {
    fullName: string;
    fullNameAr?: string;
    fullNameEn?: string;
  } | null;
};

const isDataImageUrl = (u: string): boolean => /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(u);

export type CollectAttachmentReviewInputsResult = {
  visionParts: VisionUserPart[];
  textHints: string[];
  aggregatedPdfText: string;
  pdfReliability: PdfReliabilityAggregate;
};

export const collectAttachmentReviewInputs = async (
  achievement: Record<string, unknown>
): Promise<CollectAttachmentReviewInputsResult> => {
  const rowLooksPdf = (url: string, fileName: string | null, mimeType: string | null): boolean => {
    const m = String(mimeType || "")
      .trim()
      .toLowerCase();
    if (m.includes("pdf") || m === "application/x-pdf") return true;
    const fn = String(fileName || "").trim();
    if (fn && /\.pdf([?#\/]|$)/i.test(fn)) return true;
    if (fn.toLowerCase().endsWith(".pdf")) return true;
    return isPdfAttachmentUrl(url);
  };

  const guessNameFromHttpUrl = (url: string): string | null => {
    try {
      if (!url.startsWith("http")) return null;
      const u = new URL(url);
      const seg = u.pathname.split("/").filter(Boolean).pop();
      if (!seg) return null;
      const dec = decodeURIComponent(seg);
      return dec.length > 0 && dec.length < 220 ? dec : null;
    } catch {
      return null;
    }
  };

  const textHints: string[] = [];
  const visionParts: VisionUserPart[] = [];
  const pdfTextChunks: string[] = [];
  const reliabilityEntries: Array<{
    label: string;
    reliability: import("@/lib/achievement-attachment-normalization").PdfTextReliability;
  }> = [];

  const appendPdf = async (buffer: Buffer, label: string) => {
    const slice = await buildPdfReviewInputs(buffer, label);
    textHints.push(...slice.hints);
    if (slice.text) {
      pdfTextChunks.push(slice.text);
      textHints.push(`Extracted PDF text (${label}, truncated):\n${slice.text.slice(0, 7000)}`);
    }
    reliabilityEntries.push({ label, reliability: slice.textReliability });
    if (slice.lowPdfTextReliability) {
      textHints.push(
        `PDF text reliability (${label}): LOW — automated checks will not treat missing/noisy text as contradiction. Reasons: ${slice.textReliability.reasons.join(", ") || "unspecified"}.`
      );
    }
    for (const im of slice.images) {
      if (visionParts.length >= MAX_IMAGES) break;
      visionParts.push({ type: "image_url", image_url: { url: im, detail: "low" } });
    }
    if (process.env.AI_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("[attachment-ai pdf]", label, {
        textChars: slice.text.length,
        images: slice.images.length,
        hints: slice.hints.length,
        reliability: slice.textReliability,
      });
    }
  };

  const img = typeof achievement.image === "string" ? achievement.image.trim() : "";
  if (img) {
    const primaryFn = pickStr(achievement.evidenceFileName);
    const primaryMime = inferMimeFromUrl(img);
    if (isDataImageUrl(img) && img.length <= MAX_DATA_URL_CHARS) {
      visionParts.push({ type: "image_url", image_url: { url: img, detail: "low" } });
    } else if (rowLooksPdf(img, primaryFn, primaryMime)) {
      const buf = decodePdfDataUrlToBuffer(img);
      if (buf) await appendPdf(buf, "primary");
      else if (img.startsWith("http")) {
        const got = await fetchPdfBufferForAchievementReview(img);
        if ("buffer" in got) await appendPdf(got.buffer, "primary-url");
        else textHints.push(`Primary PDF URL: could not load (${got.error}).`);
      } else {
        textHints.push("Primary file looks like PDF but the data URL could not be decoded.");
      }
    } else if (img.startsWith("http") && visionParts.length < MAX_IMAGES) {
      textHints.push(`Main image URL: ${img.slice(0, 120)}`);
      visionParts.push({ type: "image_url", image_url: { url: img, detail: "low" } });
    }
  }

  const evOnly = pickStr(achievement.evidenceUrl);
  if (evOnly && evOnly !== img) {
    const evFn = pickStr(achievement.evidenceFileName);
    const evMime = inferMimeFromUrl(evOnly);
    if (rowLooksPdf(evOnly, evFn, evMime)) {
      const buf = decodePdfDataUrlToBuffer(evOnly);
      if (buf) await appendPdf(buf, "evidenceUrl");
      else if (evOnly.startsWith("http")) {
        const got = await fetchPdfBufferForAchievementReview(evOnly);
        if ("buffer" in got) await appendPdf(got.buffer, "evidenceUrl-url");
        else textHints.push(`Evidence PDF URL: could not load (${got.error}).`);
      } else {
        textHints.push("Evidence URL looks like PDF but could not be decoded.");
      }
    }
  }

  const rawAtts = Array.isArray(achievement.attachments) ? (achievement.attachments as unknown[]) : [];

  let pdfAttIndex = 0;
  for (let ai = 0; ai < rawAtts.length; ai++) {
    const item = rawAtts[ai];
    let s = "";
    let fn: string | null = null;
    let mt: string | null = null;
    if (typeof item === "string") {
      s = item.trim();
      fn = guessNameFromHttpUrl(s);
      mt = inferMimeFromUrl(s);
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      s = (
        pickStr(o.url) ||
        pickStr(o.href) ||
        pickStr(o.src) ||
        pickStr(o.path) ||
        ""
      ).trim();
      fn =
        pickStr(o.name) ||
        pickStr(o.fileName) ||
        pickStr(o.filename) ||
        pickStr(o.originalName) ||
        pickStr(o.originalFilename) ||
        guessNameFromHttpUrl(s);
      const typeStr = pickStr(o.type);
      mt =
        pickStr(o.mimeType) ||
        pickStr(o.contentType) ||
        (typeStr?.includes("/") ? typeStr : null) ||
        (s ? inferMimeFromUrl(s) : null);
    }
    if (!s) continue;
    if (rowLooksPdf(s, fn, mt)) {
      const label = `attachment-${pdfAttIndex + 1}`;
      pdfAttIndex += 1;
      const buf = decodePdfDataUrlToBuffer(s);
      if (buf) await appendPdf(buf, label);
      else if (s.startsWith("http")) {
        const got = await fetchPdfBufferForAchievementReview(s);
        if ("buffer" in got) await appendPdf(got.buffer, `${label}-url`);
        else textHints.push(`PDF attachment: ${s.slice(0, 80)} — ${got.error}`);
      } else {
        textHints.push(`PDF attachment reference (not decoded): ${s.slice(0, 100)}`);
      }
      continue;
    }
    if (isDataImageUrl(s) && s.length <= MAX_DATA_URL_CHARS && visionParts.length < MAX_IMAGES) {
      visionParts.push({ type: "image_url", image_url: { url: s, detail: "low" } });
    } else if (s.startsWith("http") && visionParts.length < MAX_IMAGES) {
      textHints.push(`Attachment URL: ${s.slice(0, 120)}`);
      visionParts.push({ type: "image_url", image_url: { url: s, detail: "low" } });
    }
  }

  const pdfReliability = mergePdfReliability(reliabilityEntries);

  return {
    visionParts: visionParts.slice(0, MAX_IMAGES),
    textHints,
    aggregatedPdfText: pdfTextChunks.join("\n\n"),
    pdfReliability,
  };
};

export const buildAchievementRecordPayloadForAi = (
  ctx: AdminAttachmentAiRecordContext
): Record<string, unknown> => {
  const a = ctx.achievement;
  const year = resolveAchievementComparableYearFromDoc(a);

  return {
    studentSystemName: ctx.student?.fullName || "",
    studentSystemNameAr: ctx.student?.fullNameAr || "",
    studentSystemNameEn: ctx.student?.fullNameEn || "",
    achievementYearRecorded: year,
    achievementLevel: String(a.achievementLevel || a.level || ""),
    achievementType: String(a.achievementType || ""),
    achievementName: String(a.achievementName || ""),
    customAchievementName: String(a.customAchievementName || ""),
    nameAr: String(a.nameAr || ""),
    nameEn: String(a.nameEn || ""),
    title: String(a.title || ""),
    descriptionSnippet: String(a.description || "").slice(0, 1200),
    resultType: String(a.resultType || ""),
    medalType: String(a.medalType || ""),
    rank: String(a.rank || ""),
    evidenceUrl: String(a.evidenceUrl || "").slice(0, 400),
    evidenceFileName: String(a.evidenceFileName || ""),
  };
};

export type PdfAttachmentJob = {
  attachmentIndex: number;
  label: string;
  fileName: string | null;
  buffer: Buffer;
};

/** Safe URL / data-URL prefix for logs (no full base64). */
const urlPrefixForLog = (u: string): string => {
  const t = u.trim();
  if (!t) return "";
  if (t.startsWith("data:")) {
    const semi = t.indexOf(";");
    const head = semi > 0 ? t.slice(0, Math.min(semi + 24, 96)) : t.slice(0, 96);
    const b64 = t.indexOf("base64,");
    if (b64 !== -1) return `${head}...base64[len=${t.length - b64 - 7}]`;
    return head;
  }
  return t.slice(0, 120);
};

type DbAttachmentShapeRow = {
  index: number;
  kind: "string" | "object" | "other";
  keys?: string[];
  fileName?: string | null;
  name?: string | null;
  mimeType?: string | null;
  contentType?: string | null;
  urlPrefix?: string;
};

const safeDbAttachmentsShapeForLog = (raw: unknown[]): DbAttachmentShapeRow[] =>
  raw.map((item, i) => {
    if (typeof item === "string") {
      return {
        index: i,
        kind: "string",
        urlPrefix: urlPrefixForLog(item),
        mimeType: inferMimeFromUrl(item),
      };
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const url =
        pickStr(o.url) || pickStr(o.href) || pickStr(o.src) || pickStr(o.path) || "";
      return {
        index: i,
        kind: "object",
        keys: Object.keys(o).slice(0, 40),
        fileName: pickStr(o.fileName) || pickStr(o.filename),
        name: pickStr(o.name) || pickStr(o.originalName) || pickStr(o.originalFilename),
        mimeType: pickStr(o.mimeType),
        contentType: pickStr(o.contentType),
        urlPrefix: url ? urlPrefixForLog(url) : undefined,
      };
    }
    return { index: i, kind: "other" };
  });

type AttachmentInventoryRow = {
  index: number;
  source: string;
  fileName: string | null;
  mimeType: string | null;
  urlPrefix: string;
  isPdfDetected: boolean;
};

const buildAttachmentInventorySnapshot = (achievement: Record<string, unknown>): AttachmentInventoryRow[] => {
  const rows: AttachmentInventoryRow[] = [];
  let idx = 0;
  const pushRow = (source: string, url: string, fileName: string | null, mimeType: string | null) => {
    const t = url.trim();
    if (!t) return;
    rows.push({
      index: idx++,
      source,
      fileName,
      mimeType,
      urlPrefix: urlPrefixForLog(t),
      isPdfDetected: isPdfForAttachmentJob(t, fileName, mimeType),
    });
  };

  const evName = pickStr(achievement.evidenceFileName);
  const img = typeof achievement.image === "string" ? achievement.image.trim() : "";
  if (img) pushRow("image", img, evName, inferMimeFromUrl(img));

  const evUrl = pickStr(achievement.evidenceUrl);
  if (evUrl) pushRow("evidenceUrl", evUrl, evName, inferMimeFromUrl(evUrl));

  const raw = achievement.attachments;
  if (Array.isArray(raw)) {
    let n = 0;
    for (const item of raw) {
      n += 1;
      if (typeof item === "string") {
        const s = item.trim();
        if (s) pushRow(`attachments[${n}]`, s, guessFileNameFromAttachmentUrl(s), inferMimeFromUrl(s));
      } else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const url =
          pickStr(o.url) || pickStr(o.href) || pickStr(o.src) || pickStr(o.path);
        if (!url) {
          rows.push({
            index: idx++,
            source: `attachments[${n}]`,
            fileName:
              pickStr(o.name) ||
              pickStr(o.fileName) ||
              pickStr(o.filename) ||
              pickStr(o.originalName) ||
              pickStr(o.originalFilename),
            mimeType: pickStr(o.mimeType) || pickStr(o.contentType),
            urlPrefix: "(no-url)",
            isPdfDetected: false,
          });
          continue;
        }
        const fn =
          pickStr(o.name) ||
          pickStr(o.fileName) ||
          pickStr(o.filename) ||
          pickStr(o.originalName) ||
          pickStr(o.originalFilename) ||
          guessFileNameFromAttachmentUrl(url);
        const typeStr = pickStr(o.type);
        const mime =
          pickStr(o.mimeType) ||
          pickStr(o.contentType) ||
          (typeStr?.includes("/") ? typeStr : null) ||
          null;
        const resolvedMime = mime || inferMimeFromUrl(url);
        pushRow(`attachments[${n}]`, url, fn, resolvedMime);
      }
    }
  }

  return rows;
};

export const collectPdfAttachmentJobsFromAchievement = async (
  achievement: Record<string, unknown>
): Promise<PdfAttachmentJob[]> => {
  const descriptors = listPdfAttachmentSourceDescriptors(achievement);
  const jobs: PdfAttachmentJob[] = [];
  let nextIndex = 0;
  for (const d of descriptors) {
    const buf = decodePdfDataUrlToBuffer(d.url);
    if (buf) {
      jobs.push({ attachmentIndex: nextIndex++, label: d.label, fileName: d.fileName, buffer: buf });
      continue;
    }
    if (d.url.startsWith("http")) {
      const got = await fetchPdfBufferForAchievementReview(d.url);
      if ("buffer" in got)
        jobs.push({
          attachmentIndex: nextIndex++,
          label: `${d.label}-url`,
          fileName: d.fileName ?? guessFileNameFromAttachmentUrl(d.url),
          buffer: got.buffer,
        });
    }
  }
  return jobs;
};

const mergeCheckList = (vals: AdminAttachmentMatchValue[]): AdminAttachmentMatchValue => {
  if (vals.some((x) => x === "mismatch")) return "mismatch";
  if (vals.length > 0 && vals.every((x) => x === "match")) return "match";
  return "unclear";
};

const richer = (a: string | null, b: string | null): string | null => {
  const sa = String(a ?? "").trim();
  const sb = String(b ?? "").trim();
  if (!sa) return sb || null;
  if (!sb) return sa || null;
  return sb.length > sa.length ? sb : sa;
};

const mergeExtractedAcrossFiles = (
  items: AdminAttachmentPerFileReview[]
): AdminAttachmentAiExtractedEvidence => {
  const base: AdminAttachmentAiExtractedEvidence = {
    detectedStudentName: null,
    detectedYear: null,
    detectedLevel: null,
    detectedAchievementTitle: null,
    detectedMedalOrResult: null,
    detectedIssuer: null,
    notesAr: "",
    notesEn: "",
  };
  for (const it of items) {
    const ev = it.extractedEvidence;
    base.detectedStudentName = richer(base.detectedStudentName, ev.detectedStudentName);
    base.detectedYear = richer(base.detectedYear, ev.detectedYear);
    base.detectedLevel = richer(base.detectedLevel, ev.detectedLevel);
    base.detectedAchievementTitle = richer(base.detectedAchievementTitle, ev.detectedAchievementTitle);
    base.detectedMedalOrResult = richer(base.detectedMedalOrResult, ev.detectedMedalOrResult);
    base.detectedIssuer = richer(base.detectedIssuer, ev.detectedIssuer);
    if (ev.notesAr.trim()) base.notesAr = [base.notesAr, ev.notesAr].filter(Boolean).join("\n\n");
    if (ev.notesEn.trim()) base.notesEn = [base.notesEn, ev.notesEn].filter(Boolean).join("\n\n");
  }
  return base;
};

const mergeChecksAcrossFiles = (items: AdminAttachmentPerFileReview[]): AdminAttachmentAiChecks => {
  const pick = (key: keyof AdminAttachmentAiChecks): AdminAttachmentMatchValue | undefined => {
    const vals = items
      .map((i) => i.checks[key])
      .filter((v): v is AdminAttachmentMatchValue => v === "match" || v === "mismatch" || v === "unclear");
    if (vals.length === 0) return undefined;
    return mergeCheckList(vals);
  };
  const out: AdminAttachmentAiChecks = {
    nameCheck: pick("nameCheck") ?? "unclear",
    yearCheck: pick("yearCheck") ?? "unclear",
    levelCheck: pick("levelCheck") ?? "unclear",
    achievementCheck: pick("achievementCheck") ?? "unclear",
  };
  const rc = pick("resultCheck");
  if (rc !== undefined) out.resultCheck = rc;
  const dtc = pick("documentTitleCheck");
  if (dtc !== undefined) out.documentTitleCheck = dtc;
  const csc = pick("contextualSupportCheck");
  if (csc !== undefined) out.contextualSupportCheck = csc;
  const orc = pick("optionalRowDataCheck");
  if (orc !== undefined) out.optionalRowDataCheck = orc;
  return out;
};

const attachmentSummaryAr = (r: AdminAttachmentAiReviewResult): string => {
  const kind = r.detectedDocumentKind;
  if (kind === "group_list_document") {
    const g = r.groupDocumentAnalysis;
    if (g?.studentFound) return "قائمة جماعية: وُجد اسم الطالب في الجدول.";
    return "قائمة جماعية: لم يُعثر على تطابق واضح للاسم في النص المستخرج.";
  }
  if (kind === "individual_certificate") return "شهادة فردية.";
  return "وثيقة (تصنيف أولي غير مؤكد).";
};

const attachmentSummaryEn = (r: AdminAttachmentAiReviewResult): string => {
  const kind = r.detectedDocumentKind;
  if (kind === "group_list_document") {
    const g = r.groupDocumentAnalysis;
    if (g?.studentFound) return "Group list: student name found in extracted rows.";
    return "Group list: no confident name match in extracted text.";
  }
  if (kind === "individual_certificate") return "Individual certificate.";
  return "Document (preliminary classification uncertain).";
};

const stampDetectedKind = (
  guarded: AdminAttachmentAiReviewResult,
  docKindDetection: AttachmentDocumentKindResult
): AdminAttachmentAiReviewResult => ({
  ...guarded,
  ...(guarded.detectedDocumentKind
    ? {}
    : docKindDetection.confidence >= 0.42
      ? { detectedDocumentKind: docKindDetection.kind }
      : {}),
});

const buildOverallAttachmentSummaryAr = (items: AdminAttachmentPerFileReview[]): string =>
  items.length === 1
    ? items[0]!.summaryAr || ""
    : `تم تحليل ${items.length} ملفات PDF. ${items.map((it, i) => `(${i + 1}) ${it.summaryAr || ""}`).join(" ")}`;

const buildOverallAttachmentSummaryEn = (items: AdminAttachmentPerFileReview[]): string =>
  items.length === 1
    ? items[0]!.summaryEn || ""
    : `Analyzed ${items.length} PDF attachment(s). ${items.map((it, i) => `(${i + 1}) ${it.summaryEn || ""}`).join(" ")}`;

/** Max time for one PDF (extract + optional OpenAI); prevents hung requests. */
export const ATTACHMENT_REVIEW_PER_FILE_TIMEOUT_MS = 120_000;

const withPerFileTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`attachment_review_timeout_${ms}ms:${label}`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });

const buildFailedPerFileReview = (job: PdfAttachmentJob, err: unknown): AdminAttachmentPerFileReview => {
  const msg = err instanceof Error ? err.message : String(err);
  const analyzedAt = new Date().toISOString();
  return {
    attachmentIndex: job.attachmentIndex,
    fileName: job.fileName,
    label: job.label,
    pdfReliabilityLow: true,
    summaryAr: "فشل تحليل هذا المرفق",
    summaryEn: "This attachment could not be analyzed",
    overallMatchStatus: "unclear",
    checks: {
      nameCheck: "unclear",
      yearCheck: "unclear",
      levelCheck: "unclear",
      achievementCheck: "unclear",
    },
    extractedEvidence: {
      detectedStudentName: null,
      detectedYear: null,
      detectedLevel: null,
      detectedAchievementTitle: null,
      detectedMedalOrResult: null,
      detectedIssuer: null,
      notesAr: `تعذر معالجة الملف: ${msg}`,
      notesEn: `Attachment processing failed: ${msg}`,
    },
    recommendationAr: "",
    recommendationEn: "",
    analyzedAt,
    modelNote: `attachment_error:${msg.slice(0, 240)}`,
  };
};

/** Safe fallback when the whole review pipeline throws (route should persist this instead of 5xx). */
export const buildGlobalFallbackAttachmentReview = (
  message: string,
  attachmentReviews?: AdminAttachmentPerFileReview[]
): AdminAttachmentAiReviewResult => {
  const analyzedAt = new Date().toISOString();
  return {
    overallMatchStatus: "unclear",
    checks: {
      nameCheck: "unclear",
      yearCheck: "unclear",
      levelCheck: "unclear",
      achievementCheck: "unclear",
    },
    extractedEvidence: {
      detectedStudentName: null,
      detectedYear: null,
      detectedLevel: null,
      detectedAchievementTitle: null,
      detectedMedalOrResult: null,
      detectedIssuer: null,
      notesAr: message,
      notesEn: message,
    },
    recommendationAr: "",
    recommendationEn: "",
    analyzedAt,
    modelNote: "ATTACHMENT_AI_REVIEW_FAILED",
    ...(attachmentReviews && attachmentReviews.length > 0
      ? {
          attachmentReviews,
          overallAttachmentReviewSummaryAr: "تعذر إكمال التحليل بالكامل.",
          overallAttachmentReviewSummaryEn: "Full analysis could not be completed.",
        }
      : {}),
  };
};

async function analyzeOnePdfAttachment(
  ctx: AdminAttachmentAiRecordContext,
  record: Record<string, unknown>,
  job: PdfAttachmentJob
): Promise<AdminAttachmentPerFileReview> {
  const slice = await buildPdfReviewInputs(job.buffer, job.label);
  const aggregatedPdfText = slice.text;
  const pdfReliability = mergePdfReliability([{ label: job.label, reliability: slice.textReliability }]);
  const visionParts: VisionUserPart[] = slice.images.map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "low" as const },
  }));

  const textHints: string[] = [...slice.hints];
  if (slice.text) {
    textHints.push(`Extracted PDF text (${job.label}, truncated):\n${slice.text.slice(0, 7000)}`);
  }
  if (slice.lowPdfTextReliability) {
    textHints.push(
      `PDF text reliability (${job.label}): LOW — automated checks will not treat missing/noisy text as contradiction. Reasons: ${slice.textReliability.reasons.join(", ") || "unspecified"}.`
    );
  }

  const docKindDetection = detectAttachmentDocumentKind({
    text: aggregatedPdfText,
    hasRenderablePdfPreview: visionParts.length > 0,
  });

  const guardCtx = {
    record: ctx.achievement,
    studentCtx: ctx.student,
    aggregatedPdfText,
    pdfReliability,
    documentKindHint: {
      kind: docKindDetection.kind,
      confidence: docKindDetection.confidence,
      reasons: docKindDetection.reasons,
    },
  };

  let core: AdminAttachmentAiReviewResult;

  if (shouldUseGroupListAttachmentPipeline(aggregatedPdfText, docKindDetection)) {
    const groupResult = buildGroupListAttachmentReviewResult({
      ctx,
      aggregatedPdfText,
      detection: docKindDetection,
    });
    core = applyAttachmentAiGuardrails(groupResult, guardCtx);
  } else {
    const userText = buildAdminAttachmentAiUserText({
      record,
      docKindDetection,
      textHints,
      visionPartsCount: visionParts.length,
    });
    const userParts: VisionUserPart[] = [{ type: "text", text: userText }, ...visionParts];

    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] step: call_openai", job.fileName || job.label);
    const aiResult = await openAiChatJsonObjectWithVision({
      system: ADMIN_ATTACHMENT_AI_REVIEW_SYSTEM_PROMPT,
      userParts,
      maxTokens: 1600,
      temperature: 0.12,
    });

    if (!aiResult.ok) {
      core = {
        overallMatchStatus: "unclear",
        checks: {
          nameCheck: "unclear",
          yearCheck: "unclear",
          levelCheck: "unclear",
          achievementCheck: "unclear",
        },
        extractedEvidence: {
          detectedStudentName: null,
          detectedYear: null,
          detectedLevel: null,
          detectedAchievementTitle: null,
          detectedMedalOrResult: null,
          detectedIssuer: null,
          notesAr: `تعذر استدعاء نموذج التحليل لهذا الملف: ${aiResult.message}`,
          notesEn: `Model request failed for this file: ${aiResult.message}`,
        },
        recommendationAr: "",
        recommendationEn: "",
        analyzedAt: new Date().toISOString(),
        modelNote: aiResult.message,
      };
    } else {
      const parsed = parseAdminAttachmentAiPayload(aiResult.parsed);
      if (!parsed) {
        core = {
          overallMatchStatus: "unclear",
          checks: {
            nameCheck: "unclear",
            yearCheck: "unclear",
            levelCheck: "unclear",
            achievementCheck: "unclear",
          },
          extractedEvidence: {
            detectedStudentName: null,
            detectedYear: null,
            detectedLevel: null,
            detectedAchievementTitle: null,
            detectedMedalOrResult: null,
            detectedIssuer: null,
            notesAr: "بنية الاستجابة غير صالحة لهذا الملف.",
            notesEn: "Invalid model structure for this file.",
          },
          recommendationAr: "",
          recommendationEn: "",
          analyzedAt: new Date().toISOString(),
          modelNote: "parse_error",
        };
      } else {
        core = applyAttachmentAiGuardrails(parsed, guardCtx);
      }
    }
  }

  const stamped = stampDetectedKind(core, docKindDetection);
  const summaryAr = attachmentSummaryAr(stamped);
  const summaryEn = attachmentSummaryEn(stamped);

  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] step: guardrails", job.fileName || job.label);

  return {
    attachmentIndex: job.attachmentIndex,
    fileName: job.fileName,
    label: job.label,
    pdfReliabilityLow: slice.lowPdfTextReliability,
    summaryAr,
    summaryEn,
    overallMatchStatus: stamped.overallMatchStatus,
    checks: stamped.checks,
    extractedEvidence: stamped.extractedEvidence,
    recommendationAr: stamped.recommendationAr,
    recommendationEn: stamped.recommendationEn,
    analyzedAt: stamped.analyzedAt,
    modelNote: stamped.modelNote,
    detectedDocumentKind: stamped.detectedDocumentKind,
    groupDocumentAnalysis: stamped.groupDocumentAnalysis,
  };
}

export const aggregatePerFileAttachmentReviewResults = (
  items: AdminAttachmentPerFileReview[]
): AdminAttachmentAiReviewResult => {
  const checks = mergeChecksAcrossFiles(items);
  const overallMatchStatus = deriveOverallFromChecks(checks);
  const extractedEvidence = mergeExtractedAcrossFiles(items);
  const analyzedAt =
    items.map((i) => i.analyzedAt).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))[0] ?? new Date().toISOString();

  const recommendationAr = items
    .map((it, i) => (it.recommendationAr.trim() ? `(${i + 1}) ${it.recommendationAr.trim()}` : ""))
    .filter(Boolean)
    .join("\n\n");
  const recommendationEn = items
    .map((it, i) => (it.recommendationEn.trim() ? `(${i + 1}) ${it.recommendationEn.trim()}` : ""))
    .filter(Boolean)
    .join("\n\n");

  const kinds = new Set(items.map((i) => i.detectedDocumentKind).filter(Boolean));
  let detectedDocumentKind = items[0]?.detectedDocumentKind;
  if (kinds.size > 1) detectedDocumentKind = undefined;

  const groupHit = items.find((i) => i.groupDocumentAnalysis?.studentFound);
  const groupDocumentAnalysis =
    groupHit?.groupDocumentAnalysis ?? items.find((i) => i.groupDocumentAnalysis)?.groupDocumentAnalysis;

  return {
    overallMatchStatus,
    checks,
    extractedEvidence,
    recommendationAr,
    recommendationEn,
    analyzedAt,
    modelNote: items.length > 1 ? `per_file_count=${items.length}` : items[0]?.modelNote,
    ...(detectedDocumentKind ? { detectedDocumentKind } : {}),
    ...(groupDocumentAnalysis ? { groupDocumentAnalysis } : {}),
  };
};

async function runAttachmentReviewCore(
  ctx: AdminAttachmentAiRecordContext
): Promise<{ ok: true; data: AdminAttachmentAiReviewResult } | { ok: false; message: string }> {
  const record = buildAchievementRecordPayloadForAi(ctx);

  const attachDecision = (data: AdminAttachmentAiReviewResult, pdfLow: boolean): AdminAttachmentAiReviewResult => {
    const out = applyDeterministicAttachmentReviewDecision(data, {
      record: ctx.achievement,
      pdfReliabilityLow: pdfLow,
    });
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] final_decision", {
      decision: out.aiReviewDecision,
      overall: out.overallMatchStatus,
      name: out.checks.nameCheck,
      achievement: out.checks.achievementCheck,
      result: out.checks.resultCheck,
    });
    return out;
  };

  const achievementId =
    ctx.achievement._id != null ? String((ctx.achievement as { _id: unknown })._id) : "unknown";
  const hasAttachmentsArray = Array.isArray(ctx.achievement.attachments);
  const rawAttachmentItems = hasAttachmentsArray ? (ctx.achievement.attachments as unknown[]) : [];

  const inventory = buildAttachmentInventorySnapshot(ctx.achievement);
  const pdfSources = listPdfAttachmentSourceDescriptors(ctx.achievement);
  const pdfJobs = await collectPdfAttachmentJobsFromAchievement(ctx.achievement);

  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] attachment inventory", {
    achievementId,
    hasAttachmentsArray,
    attachmentArrayLength: rawAttachmentItems.length,
    items: inventory,
  });
  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] db_attachments_shape", {
    achievementId,
    attachments: safeDbAttachmentsShapeForLog(rawAttachmentItems),
  });
  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] pdfJobs", {
    achievementId,
    pdfSourceCount: pdfSources.length,
    pdfResolvedJobCount: pdfJobs.length,
    sourceLabels: pdfSources.map((d) => d.label),
    sourceFileNames: pdfSources.map((d) => d.fileName),
    resolvedFileNames: pdfJobs.map((j) => j.fileName || j.label),
  });

  if (pdfSources.length > 0) {
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] chosen_pipeline per_file_pdf");
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] step: collect_attachments", { pdfSourceCount: pdfSources.length });
    const perFile: AdminAttachmentPerFileReview[] = [];
    for (let i = 0; i < pdfSources.length; i++) {
      const d = pdfSources[i]!;
      let buffer: Buffer | null = decodePdfDataUrlToBuffer(d.url);
      if (!buffer && d.url.startsWith("http")) {
        const got = await fetchPdfBufferForAchievementReview(d.url);
        if ("buffer" in got) buffer = got.buffer;
      }
      const job: PdfAttachmentJob = {
        attachmentIndex: i,
        label: d.label,
        fileName: d.fileName,
        buffer: buffer ?? Buffer.alloc(0),
      };
      const name = d.fileName || d.label || String(i);
      if (!buffer || buffer.length === 0) {
        // eslint-disable-next-line no-console
        console.error("[AI_REVIEW] pdf_load_failed", name, d.url.slice(0, 80));
        perFile.push(buildFailedPerFileReview(job, new Error("pdf_load_failed")));
        continue;
      }
      // eslint-disable-next-line no-console
      console.log("[AI_REVIEW] step: process_pdf", name);
      try {
        const one = await withPerFileTimeout(
          analyzeOnePdfAttachment(ctx, record, job),
          ATTACHMENT_REVIEW_PER_FILE_TIMEOUT_MS,
          name
        );
        perFile.push(one);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[AI_REVIEW] attachment failed", name, err);
        perFile.push(buildFailedPerFileReview(job, err));
      }
    }
    const base = aggregatePerFileAttachmentReviewResults(perFile);
    const data: AdminAttachmentAiReviewResult = {
      ...base,
      attachmentReviews: perFile,
      overallAttachmentReviewSummaryAr: buildOverallAttachmentSummaryAr(perFile),
      overallAttachmentReviewSummaryEn: buildOverallAttachmentSummaryEn(perFile),
    };
    debugAttachmentAiSnap("attachment_ai.per_file.done", { fileCount: perFile.length, overall: data.overallMatchStatus });
    return {
      ok: true,
      data: attachDecision(data, perFile.some((p) => p.pdfReliabilityLow === true)),
    };
  }

  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] chosen_pipeline legacy_merged reason=no_pdf_jobs");

  const { visionParts, textHints, aggregatedPdfText, pdfReliability } =
    await collectAttachmentReviewInputs(ctx.achievement);

  const docKindDetection = detectAttachmentDocumentKind({
    text: aggregatedPdfText,
    hasRenderablePdfPreview: visionParts.length > 0,
  });

  debugAttachmentAiSnap("attachment_ai.collect.done", {
    aggregatedPdfTextLength: aggregatedPdfText.length,
    aggregatedPdfTextPreview: aggregatedPdfText.slice(0, 2000),
    pdfReliability,
    visionPartsCount: visionParts.length,
    textHintsCount: textHints.length,
  });
  debugAttachmentAiSnap("attachment_ai.doc_kind", {
    detectedDocumentKind: docKindDetection.kind,
    confidence: docKindDetection.confidence,
    reasons: docKindDetection.reasons,
    useGroupListPipeline: shouldUseGroupListAttachmentPipeline(aggregatedPdfText, docKindDetection),
  });

  if (shouldUseGroupListAttachmentPipeline(aggregatedPdfText, docKindDetection)) {
    const groupResult = buildGroupListAttachmentReviewResult({
      ctx,
      aggregatedPdfText,
      detection: docKindDetection,
    });
    debugAttachmentAiSnap("attachment_ai.group_result.before_guardrails", {
      overallMatchStatus: groupResult.overallMatchStatus,
      checks: groupResult.checks,
      extractedEvidence: groupResult.extractedEvidence,
      detectedDocumentKind: groupResult.detectedDocumentKind,
      groupDocumentAnalysis: groupResult.groupDocumentAnalysis,
    });
    const guarded = applyAttachmentAiGuardrails(groupResult, {
      record: ctx.achievement,
      studentCtx: ctx.student,
      aggregatedPdfText,
      pdfReliability,
      documentKindHint: {
        kind: docKindDetection.kind,
        confidence: docKindDetection.confidence,
        reasons: docKindDetection.reasons,
      },
    });
    debugAttachmentAiSnap("attachment_ai.group_result.after_guardrails", {
      overallMatchStatus: guarded.overallMatchStatus,
      checks: guarded.checks,
      extractedEvidence: guarded.extractedEvidence,
    });
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] step: guardrails", "legacy_group_list");
    return { ok: true, data: attachDecision(guarded, pdfReliability.lowTextReliability) };
  }

  const userText = buildAdminAttachmentAiUserText({
    record,
    docKindDetection,
    textHints,
    visionPartsCount: visionParts.length,
  });

  const userParts: VisionUserPart[] = [{ type: "text", text: userText }, ...visionParts];

  debugAttachmentAiSnap("attachment_ai.ai_prompt.text_part", {
    userTextLength: userText.length,
    userTextPreview: userText.slice(0, 2500),
    visionImageParts: visionParts.filter((p) => p.type === "image_url").length,
  });

  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] step: call_openai", "legacy_merged");
  const result = await withPerFileTimeout(
    openAiChatJsonObjectWithVision({
      system: ADMIN_ATTACHMENT_AI_REVIEW_SYSTEM_PROMPT,
      userParts,
      maxTokens: 1600,
      temperature: 0.12,
    }),
    ATTACHMENT_REVIEW_PER_FILE_TIMEOUT_MS,
    "legacy_merged_openai"
  );

  if (!result.ok) {
    const analyzedAt = new Date().toISOString();
    return {
      ok: true,
      data: attachDecision(
        {
          overallMatchStatus: "unclear",
          checks: {
            nameCheck: "unclear",
            yearCheck: "unclear",
            levelCheck: "unclear",
            achievementCheck: "unclear",
          },
          extractedEvidence: {
            detectedStudentName: null,
            detectedYear: null,
            detectedLevel: null,
            detectedAchievementTitle: null,
            detectedMedalOrResult: null,
            detectedIssuer: null,
            notesAr: `تعذر استدعاء نموذج التحليل: ${result.message}`,
            notesEn: result.message,
          },
          recommendationAr: "",
          recommendationEn: "",
          analyzedAt,
          modelNote: result.message,
        },
        pdfReliability.lowTextReliability
      ),
    };
  }

  debugAttachmentAiSnap("attachment_ai.raw_model", {
    rawModelOutputPreview: result.rawText.slice(0, 4000),
  });

  const parsed = parseAdminAttachmentAiPayload(result.parsed);
  if (!parsed) {
    const analyzedAt = new Date().toISOString();
    return {
      ok: true,
      data: attachDecision(
        {
          overallMatchStatus: "unclear",
          checks: {
            nameCheck: "unclear",
            yearCheck: "unclear",
            levelCheck: "unclear",
            achievementCheck: "unclear",
          },
          extractedEvidence: {
            detectedStudentName: null,
            detectedYear: null,
            detectedLevel: null,
            detectedAchievementTitle: null,
            detectedMedalOrResult: null,
            detectedIssuer: null,
            notesAr: "بنية الاستجابة غير صالحة.",
            notesEn: "Model returned an invalid structure.",
          },
          recommendationAr: "",
          recommendationEn: "",
          analyzedAt,
          modelNote: "parse_error",
        },
        pdfReliability.lowTextReliability
      ),
    };
  }

  debugAttachmentAiSnap("attachment_ai.parsed.before_guardrails", {
    overallMatchStatus: parsed.overallMatchStatus,
    checks: parsed.checks,
    extractedEvidence: parsed.extractedEvidence,
    detectedDocumentKind: parsed.detectedDocumentKind,
  });

  const guarded = applyAttachmentAiGuardrails(parsed, {
    record: ctx.achievement,
    studentCtx: ctx.student,
    aggregatedPdfText,
    pdfReliability,
    documentKindHint: {
      kind: docKindDetection.kind,
      confidence: docKindDetection.confidence,
      reasons: docKindDetection.reasons,
    },
  });

  const stamped: AdminAttachmentAiReviewResult = {
    ...guarded,
    ...(guarded.detectedDocumentKind
      ? {}
      : docKindDetection.confidence >= 0.42
        ? { detectedDocumentKind: docKindDetection.kind }
        : {}),
  };

  debugAttachmentAiSnap("attachment_ai.final.after_guardrails", {
    overallMatchStatus: stamped.overallMatchStatus,
    checks: stamped.checks,
    extractedEvidence: stamped.extractedEvidence,
    detectedDocumentKind: stamped.detectedDocumentKind,
    recommendationArPreview: stamped.recommendationAr.slice(0, 500),
    recommendationEnPreview: stamped.recommendationEn.slice(0, 500),
  });

  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] step: guardrails", "legacy_merged");

  return {
    ok: true,
    data: attachDecision(stamped, pdfReliability.lowTextReliability),
  };
}

export const runAdminAchievementAttachmentAiReview = async (
  ctx: AdminAttachmentAiRecordContext
): Promise<{ ok: true; data: AdminAttachmentAiReviewResult } | { ok: false; message: string }> => {
  try {
    return await runAttachmentReviewCore(ctx);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error("[AI_REVIEW] pipeline_exception", msg, e);
    return {
      ok: true,
      data: applyDeterministicAttachmentReviewDecision(buildGlobalFallbackAttachmentReview(msg), {
        record: ctx.achievement,
        pdfReliabilityLow: true,
      }),
    };
  }
};

/** Alias for integrations (auto-run jobs, docs): same behavior as `runAdminAchievementAttachmentAiReview`. */
export const executeAttachmentAiVerification = runAdminAchievementAttachmentAiReview;
