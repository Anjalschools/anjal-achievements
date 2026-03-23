/**
 * Safe display for proof image / attachment / link — avoid raw base64 or huge URLs in UI.
 */

const MAX_URL_PREVIEW = 48;

export const isLikelyBase64Image = (s: string): boolean =>
  typeof s === "string" && s.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(s.slice(0, 300));

export const shortenUrlForLabel = (url: string, maxLen = MAX_URL_PREVIEW): string => {
  if (!url || typeof url !== "string") return "";
  const u = url.trim();
  if (u.startsWith("data:image")) return "";
  if (u.length <= maxLen) return u;
  return u.slice(0, maxLen) + "…";
};

export type ProofSources = Record<string, unknown>;

export const getProofImageSrc = (raw: ProofSources): string | null => {
  const candidates = [raw.image, raw.proofImage, (raw as any).thumbnail, (raw as any).evidenceImage];
  for (const c of candidates) {
    if (typeof c !== "string" || !c.trim()) continue;
    const v = c.trim();
    if (v.startsWith("data:image/") && v.length < 500000) return v;
    if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/")) return v;
  }
  const ev = raw.evidenceUrl;
  if (typeof ev === "string" && ev.trim().startsWith("http") && !isLikelyBase64Image(ev)) return ev.trim();
  return null;
};

export const getProofAttachmentUrl = (raw: ProofSources): string | null => {
  const a = (raw as any).attachment || (raw as any).proofFile || (raw as any).evidenceFile;
  if (typeof a === "string" && a.trim() && !isLikelyBase64Image(a)) {
    if (a.startsWith("http") || a.startsWith("/")) return a.trim();
  }
  const atts = raw.attachments;
  if (Array.isArray(atts) && atts[0] && typeof atts[0] === "string") {
    const x = atts[0].trim();
    if (!isLikelyBase64Image(x) && (x.startsWith("http") || x.startsWith("/"))) return x;
  }
  return null;
};

export const getProofExternalLink = (raw: ProofSources): string | null => {
  const pl = (raw as any).proofLink;
  if (typeof pl === "string" && pl.trim().startsWith("http")) return pl.trim();
  const ev = raw.evidenceUrl;
  if (typeof ev === "string" && ev.trim().startsWith("http") && !getProofImageSrc(raw)) return ev.trim();
  return null;
};
