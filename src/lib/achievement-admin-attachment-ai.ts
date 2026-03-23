/**
 * Admin-only AI review of evidence attachments vs achievement record (advisory).
 */

import type {
  AdminAttachmentAiChecks,
  AdminAttachmentAiExtractedEvidence,
  AdminAttachmentAiReviewResult,
  AdminAttachmentMatchValue,
} from "@/types/admin-attachment-ai-review";
import { openAiChatJsonObjectWithVision, type VisionUserPart } from "@/lib/openai-vision-json";
import { resolveAchievementComparableYearFromDoc } from "@/lib/achievement-duplicate";
import {
  buildPdfReviewInputs,
  decodePdfDataUrlToBuffer,
  fetchPdfBufferForAchievementReview,
  isPdfAttachmentUrl,
} from "@/lib/achievement-admin-pdf-review";

const MAX_IMAGES = 3;
const MAX_DATA_URL_CHARS = 1_800_000;

const normalizeCheck = (v: unknown): AdminAttachmentMatchValue => {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (s === "match" || s === "mismatch" || s === "unclear") return s;
  return "unclear";
};

export const deriveOverallFromChecks = (checks: AdminAttachmentAiChecks): AdminAttachmentMatchValue => {
  const vals = Object.values(checks);
  if (vals.some((x) => x === "mismatch")) return "mismatch";
  if (vals.length > 0 && vals.every((x) => x === "match")) return "match";
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
  };

  const evRaw = o.extractedEvidence;
  const evObj =
    evRaw && typeof evRaw === "object" ? (evRaw as Record<string, unknown>) : {};

  const extractedEvidence: AdminAttachmentAiExtractedEvidence = {
    detectedStudentName: pickStr(evObj.detectedStudentName),
    detectedYear: pickStr(evObj.detectedYear),
    detectedLevel: pickStr(evObj.detectedLevel),
    detectedAchievementTitle: pickStr(evObj.detectedAchievementTitle),
    notesAr: pickStr(evObj.notesAr) || "",
    notesEn: pickStr(evObj.notesEn) || "",
  };

  const overallMatchStatus = deriveOverallFromChecks(checks);

  const recommendationAr = pickStr(o.recommendationAr) || "";
  const recommendationEn = pickStr(o.recommendationEn) || "";

  return {
    overallMatchStatus,
    checks,
    extractedEvidence,
    recommendationAr,
    recommendationEn,
    analyzedAt: new Date().toISOString(),
    modelNote: pickStr(o.modelNote) || undefined,
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

export const collectAttachmentReviewInputs = async (
  achievement: Record<string, unknown>
): Promise<{ visionParts: VisionUserPart[]; textHints: string[] }> => {
  const textHints: string[] = [];
  const visionParts: VisionUserPart[] = [];

  const appendPdf = async (buffer: Buffer, label: string) => {
    const slice = await buildPdfReviewInputs(buffer, label);
    textHints.push(...slice.hints);
    if (slice.text) {
      textHints.push(`Extracted PDF text (${label}, truncated):\n${slice.text.slice(0, 7000)}`);
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
      });
    }
  };

  const img = typeof achievement.image === "string" ? achievement.image.trim() : "";
  if (img) {
    if (isDataImageUrl(img) && img.length <= MAX_DATA_URL_CHARS) {
      visionParts.push({ type: "image_url", image_url: { url: img, detail: "low" } });
    } else if (isPdfAttachmentUrl(img)) {
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

  const atts = Array.isArray(achievement.attachments)
    ? (achievement.attachments as string[]).filter((x) => typeof x === "string")
    : [];

  let pdfAttIndex = 0;
  for (const u of atts) {
    const s = u.trim();
    if (!s) continue;
    if (isPdfAttachmentUrl(s)) {
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

  return { visionParts: visionParts.slice(0, MAX_IMAGES), textHints };
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

export const runAdminAchievementAttachmentAiReview = async (
  ctx: AdminAttachmentAiRecordContext
): Promise<{ ok: true; data: AdminAttachmentAiReviewResult } | { ok: false; message: string }> => {
  const record = buildAchievementRecordPayloadForAi(ctx);
  const { visionParts, textHints } = await collectAttachmentReviewInputs(ctx.achievement);

  const system = `You are an expert document reviewer for a Saudi student achievements platform.
Return ONE JSON object only (no markdown).

Each check must be exactly one of: "match", "mismatch", "unclear".
Rules:
- "match" only if the document clearly supports consistency with the system record.
- "mismatch" if there is a clear contradiction (different student name, wrong year, wrong event title, wrong level scope).
- "unclear" if the file is unreadable, cropped, irrelevant, or evidence is insufficient — prefer unclear over false confidence.
- Year: compare calendar year only (ignore day/month differences).
- Level: compare Arabic/English labels for school/province/kingdom/international scope if visible.
- If no readable images are provided, set visual-dependent checks to "unclear" unless the description text clearly confirms.

JSON shape:
{
  "overallMatchStatus": "match"|"mismatch"|"unclear",
  "checks": {
    "nameCheck": "...",
    "yearCheck": "...",
    "levelCheck": "...",
    "achievementCheck": "..."
  },
  "extractedEvidence": {
    "detectedStudentName": string|null,
    "detectedYear": string|null,
    "detectedLevel": string|null,
    "detectedAchievementTitle": string|null,
    "notesAr": string,
    "notesEn": string
  },
  "recommendationAr": string,
  "recommendationEn": string,
  "modelNote": string
}`;

  const hintBlock =
    textHints.length > 0
      ? `\nملاحظات على المرفقات (روابط/أنواع):\n${textHints.join("\n")}\n`
      : "";

  const userText = `سجل النظام (JSON):\n${JSON.stringify(record)}${hintBlock}\n${
    visionParts.length === 0
      ? "لا توجد صور قابلة للتحليل البصري المباشر في هذه الطلبية — إن وُجد نص PDF مستخرج ضمن الملاحظات فاستخدمه بحذر؛ وإلا اجعل الحقول غير المؤكدة unclear."
      : `عدد الصور المرفقة للتحليل البصري: ${visionParts.length}`
  }`;

  const userParts: VisionUserPart[] = [{ type: "text", text: userText }, ...visionParts];

  const result = await openAiChatJsonObjectWithVision({
    system,
    userParts,
    maxTokens: 1600,
    temperature: 0.12,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const parsed = parseAdminAttachmentAiPayload(result.parsed);
  if (!parsed) {
    return { ok: false, message: "Model returned an invalid structure" };
  }

  const checks = parsed.checks;
  const overall = deriveOverallFromChecks(checks);

  return {
    ok: true,
    data: {
      ...parsed,
      overallMatchStatus: overall,
    },
  };
};
