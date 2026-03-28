/**
 * Enumerate PDF attachment sources on an achievement document (Mongo / API shapes).
 * Stays free of server-only imports so scripts and tests can import it.
 */

import { inferMimeFromUrl } from "@/lib/achievement-attachments";
import { isPdfAttachmentUrl } from "@/lib/achievement-pdf-url-match";

const pickStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t || null;
};

export type PdfAttachmentSourceDescriptor = {
  url: string;
  label: string;
  fileName: string | null;
  mimeType: string | null;
};

export const isPdfForAttachmentJob = (url: string, fileName: string | null, mimeType: string | null): boolean => {
  const m = String(mimeType || "")
    .trim()
    .toLowerCase();
  if (m.includes("pdf") || m === "application/x-pdf") return true;
  const fn = String(fileName || "").trim();
  if (fn && /\.pdf([?#\/]|$)/i.test(fn)) return true;
  if (fn.toLowerCase().endsWith(".pdf")) return true;
  return isPdfAttachmentUrl(url);
};

export const guessFileNameFromAttachmentUrl = (url: string): string | null => {
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

/**
 * PDF sources to review (deduped by URL). Includes `image`, `evidenceUrl`, and each `attachments[]` item
 * when MIME, filename, or URL indicates PDF — including Mongo object shape `{ url, mimeType|contentType, name }`.
 */
export const listPdfAttachmentSourceDescriptors = (
  achievement: Record<string, unknown>
): PdfAttachmentSourceDescriptor[] => {
  const out: PdfAttachmentSourceDescriptor[] = [];
  const seen = new Set<string>();

  const add = (url: string, label: string, fileName: string | null, mimeType: string | null) => {
    const t = url.trim();
    if (!t || seen.has(t)) return;
    if (!isPdfForAttachmentJob(t, fileName, mimeType)) return;
    seen.add(t);
    out.push({ url: t, label, fileName, mimeType });
  };

  const evName = pickStr(achievement.evidenceFileName);

  const img = typeof achievement.image === "string" ? achievement.image.trim() : "";
  if (img) add(img, "primary", evName, inferMimeFromUrl(img));

  const evUrl = pickStr(achievement.evidenceUrl);
  if (evUrl) add(evUrl, "evidenceUrl", evName, inferMimeFromUrl(evUrl));

  const raw = achievement.attachments;
  if (Array.isArray(raw)) {
    let n = 0;
    for (const item of raw) {
      n += 1;
      if (typeof item === "string") {
        const s = item.trim();
        if (s)
          add(s, `attachment-${n}`, guessFileNameFromAttachmentUrl(s), inferMimeFromUrl(s));
      } else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const url =
          pickStr(o.url) || pickStr(o.href) || pickStr(o.src) || pickStr(o.path);
        if (!url) continue;
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
        add(url, `attachment-${n}`, fn, resolvedMime);
      }
    }
  }

  return out;
};
