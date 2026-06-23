import "server-only";
import { openAiChatJsonObjectWithVision, type VisionUserPart } from "@/lib/openai-vision-json";
import {
  INSTITUTION_REPORT_RATING_FIELDS,
  type InstitutionReportRatingRowStatus,
} from "@/lib/partnerships/institution-final-report-constants";
import type { InstitutionReportVisionVerification } from "@/lib/partnerships/institution-final-report-vision-shared";

export type {
  InstitutionReportVisionRatingRow,
  InstitutionReportVisionVerification,
} from "@/lib/partnerships/institution-final-report-vision-shared";

export {
  visionRatingValue,
  visionRowIsMultiple,
  visionRowIsValid,
} from "@/lib/partnerships/institution-final-report-vision-shared";

const DEBUG = process.env.AI_DEBUG === "1";

const RATING_KEYS = INSTITUTION_REPORT_RATING_FIELDS.map((row) => row.key).join(", ");

const clampConfidence = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const clampRating = (value: unknown): number | undefined => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return undefined;
  return n;
};

const parseRowStatus = (value: unknown): InstitutionReportRatingRowStatus => {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "VALID" || raw === "EMPTY" || raw === "MULTIPLE") return raw;
  return "EMPTY";
};

const buildVisionDataUrl = (buffer: Buffer, mimeType: string) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const normalizeVisionVerification = (
  parsed: Record<string, unknown>
): InstitutionReportVisionVerification => {
  const rawRows = Array.isArray(parsed.ratingRows) ? parsed.ratingRows : [];
  const rowByKey = new Map<string, InstitutionReportVisionVerification["ratingRows"][number]>();

  for (const field of INSTITUTION_REPORT_RATING_FIELDS) {
    rowByKey.set(field.key, { key: field.key, rowStatus: "EMPTY" });
  }

  for (const item of rawRows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key || "").trim();
    if (!rowByKey.has(key)) continue;
    rowByKey.set(key, {
      key,
      rowStatus: parseRowStatus(row.rowStatus),
      selectedRating: clampRating(row.selectedRating),
      confidence: clampConfidence(row.confidence),
    });
  }

  return {
    ratingRows: [...rowByKey.values()],
    stampDetected: parsed.stampDetected === true,
    stampConfidence: clampConfidence(parsed.stampConfidence),
    signatureDetected: parsed.signatureDetected === true,
    signatureConfidence: clampConfidence(parsed.signatureConfidence),
    visionConfidence: clampConfidence(parsed.visionConfidence),
  };
};

export const verifyInstitutionReportVisually = async (
  buffer: Buffer,
  mimeType: string,
  ocrPreview: string
): Promise<InstitutionReportVisionVerification | null> => {
  const system = `You visually verify Arabic institution training final evaluation reports (scanned PDFs or photos).
Inspect checkboxes/ticks in the rating matrix (columns 5,4,3,2,1), official stamp area, and handwritten signature area.
Detect pen marks: ✓ ✔ blue/black ticks, handwritten checks — not printed template text alone.
Ignore printed supervisor names; only detect handwritten signature strokes.
Return JSON only with:
ratingRows: array of { key, rowStatus ("VALID"|"EMPTY"|"MULTIPLE"), selectedRating (1-5 or null), confidence (0-100) }
  keys: ${RATING_KEYS}
stampDetected (boolean), stampConfidence (0-100) — circular/rectangular/Arabic institutional seals, partial overlap OK
signatureDetected (boolean), signatureConfidence (0-100) — handwritten signature only
visionConfidence (0-100) — overall visual read confidence
Use null for unknown ratings. Do not invent checked boxes.`;

  const userParts: VisionUserPart[] = [
    {
      type: "text",
      text: `OCR preview (may be empty/unreliable for scans):\n${ocrPreview.slice(0, 2500)}\n\nVisually verify rating checkboxes, stamp, and signature.`,
    },
    { type: "image_url", image_url: { url: buildVisionDataUrl(buffer, mimeType), detail: "high" } },
  ];

  const result = await openAiChatJsonObjectWithVision({ system, userParts, maxTokens: 2200 });
  if (!result.ok || !result.parsed || typeof result.parsed !== "object") {
    if (DEBUG) console.warn("[institution-final-report-vision]", result);
    return null;
  }

  const normalized = normalizeVisionVerification(result.parsed as Record<string, unknown>);

  if (DEBUG) {
    console.info("[institution-final-report-vision:debug]", {
      visionConfidence: normalized.visionConfidence,
      validRows: normalized.ratingRows.filter((row) => row.rowStatus === "VALID").length,
      stampDetected: normalized.stampDetected,
      signatureDetected: normalized.signatureDetected,
    });
  }

  return normalized;
};
