import { createHash } from "node:crypto";
import { normalizeAlumniSearchToken } from "@/lib/alumni/arabic-search-normalize";

export const normalizeMemoryCaptionForDedupe = (caption: string): string =>
  normalizeAlumniSearchToken(String(caption ?? "").slice(0, 500));

/** Stable fingerprint from CDN URL (public id tail) — avoids storing binary hashes on the client. */
export const alumniMemoryImageFingerprint = (imageUrl: string): string => {
  const u = String(imageUrl || "").trim();
  if (!u) return "";
  try {
    const noQuery = u.split("?")[0] || u;
    const parts = noQuery.split("/").filter(Boolean);
    return parts.slice(-4).join("/").toLowerCase();
  } catch {
    return createHash("sha256").update(u).digest("hex").slice(0, 40);
  }
};

export type MemoryPostDedupeInput = {
  caption: string;
  memoryYear?: number | null;
  imageUrl: string;
};

/**
 * Lightweight duplicate guard: same user’s posts only (caller filters).
 * Matches when same image URL fingerprint within window, or same normalized caption+year.
 */
export const hasRecentDuplicateMemoryPost = (
  existing: Array<{
    _id?: { toString(): string } | string;
    status?: string;
    caption?: string;
    memoryYear?: number | null;
    imageUrl?: string;
    submittedAt?: Date | null;
  }>,
  candidate: MemoryPostDedupeInput,
  opts?: { excludePostId?: string; windowMs?: number }
): boolean => {
  const windowMs = opts?.windowMs ?? 48 * 60 * 60 * 1000;
  const now = Date.now();
  const cap = normalizeMemoryCaptionForDedupe(candidate.caption);
  const imgFp = alumniMemoryImageFingerprint(candidate.imageUrl);
  const y = candidate.memoryYear;
  for (const p of existing) {
    const id = typeof p._id === "object" && p._id && "toString" in p._id ? p._id.toString() : String(p._id || "");
    if (opts?.excludePostId && id === opts.excludePostId) continue;
    const st = String(p.status || "");
    if (st === "rejected") continue;
    const submitted = p.submittedAt ? new Date(p.submittedAt).getTime() : 0;
    if (now - submitted > windowMs) continue;
    const pImg = alumniMemoryImageFingerprint(String(p.imageUrl || ""));
    if (imgFp.length > 4 && pImg === imgFp) return true;
    const pCap = normalizeMemoryCaptionForDedupe(String(p.caption || ""));
    if (cap.length >= 6 && pCap === cap && y != null && Number(p.memoryYear) === Number(y)) return true;
  }
  return false;
};
