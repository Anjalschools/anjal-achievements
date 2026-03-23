/**
 * Shared attachment open/download helpers (admin + any context where direct `data:` navigation is blocked).
 * Aligns with student pipeline: URLs are pre-validated via `resolveStudentAttachmentHref`.
 */

import { studentDataUrlDownloadName } from "@/lib/student-achievement-details-display";

/** Convert a data URL to a temporary object URL for opening in a new tab or download. */
export const dataUrlToObjectUrl = (dataUrl: string): string | null => {
  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0 || !dataUrl.trim().toLowerCase().startsWith("data:")) return null;
    const meta = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    const isBase64 = /;base64/i.test(meta);
    const mimeMatch = /^data:([^;,]+)/i.exec(meta);
    const mime = (mimeMatch?.[1] || "application/octet-stream").trim();
    let bytes: Uint8Array;
    if (isBase64) {
      const bin = atob(payload.replace(/\s/g, ""));
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

const revokeLater = (objectUrl: string, ms: number): void => {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      /* ignore */
    }
  }, ms);
};

/**
 * Open a resolved href in a new browsing context.
 * - `data:` → blob URL + window.open (avoids "Not allowed to navigate top frame to data URL").
 * - http(s) / same-site paths → synthetic `<a target="_blank">` click.
 */
export const openResolvedAttachmentInNewTab = (href: string): boolean => {
  if (!href || /^\s*javascript:/i.test(href)) return false;

  if (href.startsWith("data:")) {
    if (typeof window === "undefined") return false;
    const blobUrl = dataUrlToObjectUrl(href);
    if (!blobUrl) return false;
    const w = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (!w) {
      URL.revokeObjectURL(blobUrl);
      return false;
    }
    revokeLater(blobUrl, 120_000);
    return true;
  }

  if (typeof document === "undefined") return false;
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
};

/** Trigger browser download; uses blob for `data:` URLs. */
export const downloadResolvedAttachment = (href: string, suggestedName?: string): boolean => {
  if (!href || /^\s*javascript:/i.test(href)) return false;

  if (typeof document === "undefined") return false;

  if (href.startsWith("data:")) {
    const blobUrl = dataUrlToObjectUrl(href);
    if (!blobUrl) return false;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = suggestedName?.trim() || studentDataUrlDownloadName(href);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    revokeLater(blobUrl, 3_000);
    return true;
  }

  const a = document.createElement("a");
  a.href = href;
  if (suggestedName?.trim()) a.download = suggestedName.trim();
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
};
