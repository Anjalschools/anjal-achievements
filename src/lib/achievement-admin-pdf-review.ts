/**
 * Server-only: extract text + render limited PDF pages for admin attachment AI review.
 */

import "server-only";
import { PDFParse } from "pdf-parse";
import { assessPdfExtractedTextReliability } from "@/lib/achievement-attachment-normalization";
import { debugAttachmentAiSnap } from "@/lib/achievement-attachment-ai-pipeline-debug";

export const MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW = 5 * 1024 * 1024;
/** Enough pages to include typical roster tables (e.g. page 4) while bounding cost. */
export const PDF_REVIEW_TEXT_FIRST_PAGES = 10;
export const PDF_REVIEW_RENDER_FIRST_PAGES = 2;
export const PDF_REVIEW_RENDER_SCALE = 1.2;
export const PDF_REVIEW_MAX_TEXT_CHARS = 12_000;
export const PDF_REVIEW_MAX_DATA_URL_CHARS = 1_800_000;

/** Preserve line breaks so certificate / table extraction can use line-based heuristics. */
export const normalizePdfExtractedTextForReview = (raw: string): string =>
  String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, PDF_REVIEW_MAX_TEXT_CHARS);

const isValidHttpUrl = (s: string): boolean => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

/** Decode `data:application/pdf;base64,...` to a buffer, or null. */
export const decodePdfDataUrlToBuffer = (url: string): Buffer | null => {
  const t = url.trim();
  if (!/^data:application\/pdf/i.test(t)) return null;
  const idx = t.indexOf("base64,");
  if (idx === -1) return null;
  try {
    const buf = Buffer.from(t.slice(idx + 7), "base64");
    return buf.length > 0 && buf.length <= MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW ? buf : null;
  } catch {
    return null;
  }
};

export { isPdfAttachmentUrl } from "@/lib/achievement-pdf-url-match";

export async function fetchPdfBufferForAchievementReview(
  url: string
): Promise<{ buffer: Buffer } | { error: string }> {
  if (!isValidHttpUrl(url)) return { error: "invalid_url" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*" },
    });
    if (!res.ok) return { error: `http_${res.status}` };
    const cl = res.headers.get("content-length");
    if (cl && parseInt(cl, 10) > MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW) {
      return { error: "pdf_too_large" };
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW) return { error: "pdf_too_large" };
    return { buffer: Buffer.from(ab) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function extractPdfTextForAchievementReview(
  buffer: Buffer
): Promise<{ text: string; error?: string }> {
  if (buffer.length > MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW) {
    return { text: "", error: "pdf_too_large" };
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const tr = await parser.getText({ first: PDF_REVIEW_TEXT_FIRST_PAGES });
    const text = normalizePdfExtractedTextForReview(String(tr.text || ""));
    return { text };
  } catch (e) {
    return { text: "", error: e instanceof Error ? e.message : "pdf_text_failed" };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function renderPdfPagesForAchievementReview(
  buffer: Buffer,
  opts?: { maxPages?: number; scale?: number }
): Promise<{ images: string[]; error?: string }> {
  if (buffer.length > MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW) {
    return { images: [], error: "pdf_too_large" };
  }
  const maxPages = Math.min(
    opts?.maxPages ?? PDF_REVIEW_RENDER_FIRST_PAGES,
    PDF_REVIEW_RENDER_FIRST_PAGES
  );
  const scale = Math.min(opts?.scale ?? PDF_REVIEW_RENDER_SCALE, 2);
  const parser = new PDFParse({ data: buffer });
  try {
    const shot = await parser.getScreenshot({
      first: maxPages,
      scale,
      imageDataUrl: true,
    });
    const images: string[] = [];
    for (const p of shot.pages) {
      const url = String(p.dataUrl || "");
      if (
        url.startsWith("data:image/png;base64,") &&
        url.length <= PDF_REVIEW_MAX_DATA_URL_CHARS
      ) {
        images.push(url);
      }
    }
    return { images };
  } catch (e) {
    return { images: [], error: e instanceof Error ? e.message : "pdf_render_failed" };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export type PdfReviewSlice = {
  text: string;
  images: string[];
  hints: string[];
  textReliability: import("@/lib/achievement-attachment-normalization").PdfTextReliability;
  lowPdfTextReliability: boolean;
};

/**
 * One pass: text from first pages + rendered images from first pages (performance-friendly).
 */
export async function buildPdfReviewInputs(
  buffer: Buffer,
  label: string
): Promise<PdfReviewSlice> {
  const hints: string[] = [];
  if (buffer.length > MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW) {
    hints.push(`PDF (${label}): file exceeds size limit for server review.`);
    const emptyRel = assessPdfExtractedTextReliability("");
    return { text: "", images: [], hints, textReliability: emptyRel, lowPdfTextReliability: true };
  }

  const parser = new PDFParse({ data: buffer });
  try {
    let text = "";
    let textReliability = assessPdfExtractedTextReliability("");
    try {
      const tr = await parser.getText({ first: PDF_REVIEW_TEXT_FIRST_PAGES });
      const rawText = String(tr.text || "");
      textReliability = assessPdfExtractedTextReliability(rawText);
      text = normalizePdfExtractedTextForReview(rawText);
      debugAttachmentAiSnap("pdf_review.build_slice", {
        label,
        rawExtractedPdfTextPreview: String(rawText).slice(0, 2000),
        rawExtractedPdfTextLength: String(rawText).length,
        cleanedExtractedPdfTextLength: text.length,
        cleanedExtractedPdfTextPreview: text.slice(0, 2000),
        textReliability,
        lowPdfTextReliability: textReliability.lowTextReliability || !text,
      });
      if (!text) hints.push(`PDF (${label}): no extractable text in the first pages.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "pdf_text_failed";
      hints.push(`PDF (${label}): text extraction failed (${msg}).`);
      textReliability = assessPdfExtractedTextReliability("");
    }

    let images: string[] = [];
    try {
      const shot = await parser.getScreenshot({
        first: PDF_REVIEW_RENDER_FIRST_PAGES,
        scale: PDF_REVIEW_RENDER_SCALE,
        imageDataUrl: true,
      });
      images = shot.pages
        .map((p) => String(p.dataUrl || ""))
        .filter(
          (url) =>
            url.startsWith("data:image/png;base64,") &&
            url.length <= PDF_REVIEW_MAX_DATA_URL_CHARS
        );
      if (images.length === 0) {
        hints.push(`PDF (${label}): could not render pages to preview images.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "pdf_render_failed";
      hints.push(`PDF (${label}): render failed (${msg}).`);
    }

    if (!text && images.length === 0) {
      hints.push(`PDF (${label}): no usable text or images for AI review.`);
    }

    const lowPdfTextReliability = textReliability.lowTextReliability || !text;

    return { text, images, hints, textReliability, lowPdfTextReliability };
  } finally {
    await parser.destroy().catch(() => {});
  }
}
