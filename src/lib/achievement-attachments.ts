/**
 * Normalize achievement attachments for storage and API responses.
 * Supports legacy string-only entries and { url, mimeType, name } objects.
 */

export type AchievementAttachmentStored = string | AchievementAttachmentObject;

export type AchievementAttachmentObject = {
  url: string;
  mimeType: string;
  name: string;
  /** R2 object key when stored on Cloudflare R2. */
  key?: string;
  size?: number;
  provider?: string;
};

const DATA_URL_MIME = /^data:([^;]+);/i;

export const extractAttachmentUrl = (raw: unknown): string | null => {
  if (typeof raw === "string") {
    const t = raw.trim();
    return t || null;
  }
  if (raw && typeof raw === "object" && typeof (raw as { url?: unknown }).url === "string") {
    const u = String((raw as { url: string }).url).trim();
    return u || null;
  }
  return null;
};

export const inferMimeFromUrl = (url: string): string => {
  const s = url.trim();
  const m = DATA_URL_MIME.exec(s);
  if (m?.[1]) return m[1].toLowerCase();
  const lower = s.toLowerCase();
  if (lower.includes(".pdf")) return "application/pdf";
  if (lower.match(/\.(png|webp)(\?|#|$)/)) return "image/png";
  if (lower.match(/\.(jpe?g)(\?|#|$)/)) return "image/jpeg";
  if (lower.match(/\.gif(\?|#|$)/)) return "image/gif";
  return "application/octet-stream";
};

export const inferNameFromUrl = (url: string): string => {
  const s = url.trim();
  const mime = inferMimeFromUrl(s);
  if (mime.includes("pdf")) return "attachment.pdf";
  if (mime.startsWith("image/")) {
    if (mime.includes("png")) return "image.png";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "image.jpg";
    if (mime.includes("webp")) return "image.webp";
    if (mime.includes("gif")) return "image.gif";
    return "image";
  }
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const base = u.pathname.split("/").pop() || "";
      if (base) return decodeURIComponent(base.slice(0, 120));
    }
  } catch {
    /* ignore */
  }
  return "attachment";
};

/** Coerce one incoming value (API body) to a storable attachment object. */
export const coerceAttachmentForStorage = (raw: unknown): AchievementAttachmentObject | null => {
  if (typeof raw === "string") {
    const url = raw.trim();
    if (!url) return null;
    return {
      url,
      mimeType: inferMimeFromUrl(url),
      name: inferNameFromUrl(url),
    };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!url) return null;
    const mimeCandidate =
      typeof o.mimeType === "string" && o.mimeType.trim()
        ? o.mimeType.trim()
        : typeof o.contentType === "string" && o.contentType.trim()
          ? o.contentType.trim()
          : typeof o.type === "string" && o.type.trim() && o.type.includes("/")
            ? o.type.trim()
            : "";
    const mimeResolved = mimeCandidate || inferMimeFromUrl(url);
    const name =
      typeof o.name === "string" && o.name.trim()
        ? o.name.trim()
        : typeof o.fileName === "string" && o.fileName.trim()
          ? o.fileName.trim()
          : typeof o.filename === "string" && o.filename.trim()
            ? o.filename.trim()
            : typeof o.originalName === "string" && o.originalName.trim()
              ? o.originalName.trim()
              : typeof o.originalFilename === "string" && o.originalFilename.trim()
                ? o.originalFilename.trim()
                : inferNameFromUrl(url);
    const out: AchievementAttachmentObject = { url, mimeType: mimeResolved, name };
    const key = typeof o.key === "string" && o.key.trim() ? o.key.trim() : undefined;
    if (key) out.key = key;
    const provider = typeof o.provider === "string" && o.provider.trim() ? o.provider.trim() : undefined;
    if (provider) out.provider = provider;
    const sizeRaw = o.size;
    const size =
      typeof sizeRaw === "number" && Number.isFinite(sizeRaw) && sizeRaw >= 0
        ? sizeRaw
        : typeof sizeRaw === "string" && /^\d+$/.test(sizeRaw.trim())
          ? Number(sizeRaw.trim())
          : undefined;
    if (size !== undefined) out.size = size;
    return out;
  }
  return null;
};

/** Normalize a full attachments array from the client or DB. */
export const normalizeAttachmentsArray = (raw: unknown): AchievementAttachmentObject[] => {
  if (!Array.isArray(raw)) return [];
  const out: AchievementAttachmentObject[] = [];
  for (const item of raw) {
    const c = coerceAttachmentForStorage(item);
    if (c) out.push(c);
  }
  return out;
};

/** Serialize for student GET: URL strings (forms + legacy) + rich items for UI. */
export const serializeAttachmentsForStudentApi = (
  raw: unknown
): { attachments: string[]; attachmentItems: AchievementAttachmentObject[] } => {
  const items = normalizeAttachmentsArray(raw);
  return {
    attachments: items.map((x) => x.url),
    attachmentItems: items,
  };
};

/** True when opening this href in a new tab would hit a JSON API (white / useless page). */
export const isNonRenderableAttachmentHref = (href: string): boolean => {
  const s = href.trim();
  if (!s) return true;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.pathname.startsWith("/api/")) return true;
    } catch {
      return true;
    }
    return false;
  }
  if (s.startsWith("/api/")) return true;
  return false;
};
