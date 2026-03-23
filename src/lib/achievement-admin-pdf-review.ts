/**
 * Server-only: extract text + render limited PDF pages for admin attachment AI review.
 */

import "server-only";
import { PDFParse } from "pdf-parse";

export const MAX_PDF_BYTES_FOR_ACHIEVEMENT_REVIEW = 5 * 1024 * 1024;
export const PDF_REVIEW_TEXT_FIRST_PAGES = 4;
export const PDF_REVIEW_RENDER_FIRST_PAGES = 2;
export const PDF_REVIEW_RENDER_SCALE = 1.2;
export const PDF_REVIEW_MAX_TEXT_CHARS = 12_000;
export const PDF_REVIEW_MAX_DATA_URL_CHARS = 1_800_000;

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

export const isPdfAttachmentUrl = (u: string): boolean => {
  const s = u.trim();
  return /^data:application\/pdf/i.test(s) || /\.pdf(\?|#|$)/i.test(s);
};

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
    const text = String(tr.text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, PDF_REVIEW_MAX_TEXT_CHARS);
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
    return { text: "", images: [], hints };
  }

  const parser = new PDFParse({ data: buffer });
  try {
    let text = "";
    try {
      const tr = await parser.getText({ first: PDF_REVIEW_TEXT_FIRST_PAGES });
      text = String(tr.text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, PDF_REVIEW_MAX_TEXT_CHARS);
      if (!text) hints.push(`PDF (${label}): no extractable text in the first pages.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "pdf_text_failed";
      hints.push(`PDF (${label}): text extraction failed (${msg}).`);
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

    return { text, images, hints };
  } finally {
    await parser.destroy().catch(() => {});
  }
}
