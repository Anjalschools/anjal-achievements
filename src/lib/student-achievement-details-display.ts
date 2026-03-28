/**
 * Student-facing achievement detail labels: never expose raw DB slugs, Mongo ids, or bare enums.
 */

import {
  extractAttachmentUrl,
  isNonRenderableAttachmentHref,
} from "@/lib/achievement-attachments";
import type { AchievementLabelLocale } from "@/lib/achievement-labels";
import { labelAchievementSlugOrKey, labelCertificateUiStatus } from "@/lib/achievement-labels";
import {
  getAchievementLevelLabel,
  getAchievementTypeLabel,
  getResultTypeLabel,
} from "@/lib/achievement-display-labels";
import { formatAchievementFieldLabel, formatOrgLabel } from "@/lib/admin-achievement-labels";
import type { CertificateUiStatus } from "@/lib/certificate-eligibility";
import { isArabicText } from "@/lib/achievementNormalize";
import {
  formatLocalizedResultLine,
  getAchievementDisplayName,
  isLikelyTechnicalSlug,
  labelAchievementCategory,
  labelAchievementClassification,
  safeTrim,
} from "@/lib/achievementDisplay";

type Loc = AchievementLabelLocale;

export const studentNotSpecified = (loc: Loc): string =>
  loc === "ar" ? "غير محدد" : "Not specified";

export const studentFormatCategory = (v: unknown, loc: Loc): string => {
  const s = safeTrim(v);
  if (!s) return studentNotSpecified(loc);
  const direct = labelAchievementCategory(s, loc);
  if (direct && direct !== "—" && direct !== s) return direct;
  if (direct === s && !isLikelyTechnicalSlug(s)) return s;
  return labelAchievementSlugOrKey(s, loc);
};

export const studentFormatClassification = (v: unknown, loc: Loc): string => {
  const s = safeTrim(v);
  if (!s) return studentNotSpecified(loc);
  const direct = labelAchievementClassification(s, loc);
  if (direct && direct !== "—" && direct !== s) return direct;
  if (direct === s && !isLikelyTechnicalSlug(s)) return s;
  return labelAchievementSlugOrKey(s, loc);
};

export const studentFormatField = (v: unknown, loc: Loc): string => {
  const s = safeTrim(v);
  if (!s) return studentNotSpecified(loc);
  return formatAchievementFieldLabel(s, loc);
};

export const studentFormatAchievementType = (v: unknown, loc: Loc): string =>
  getAchievementTypeLabel(v, loc);

const isLikelyMongoObjectId = (s: string): boolean => /^[a-f0-9]{24}$/i.test(s);

/**
 * Student-visible achievement title: never show raw type slugs, enums, or Mongo ids.
 * Order: custom names → card/slug resolution → activity type label → safe fallback.
 */
export const studentFormatAchievementTitle = (raw: Record<string, unknown>, loc: Loc): string => {
  const pickCustom = (): string | null => {
    for (const key of [
      "customAchievementName",
      "customProgramName",
      "customCompetitionName",
      "customExhibitionName",
    ] as const) {
      const s = safeTrim(raw[key]);
      if (!s) continue;
      if (isLikelyMongoObjectId(s)) continue;
      if (isLikelyTechnicalSlug(s)) return labelAchievementSlugOrKey(s, loc);
      return s;
    }
    return null;
  };

  const fromCustom = pickCustom();
  if (fromCustom) return fromCustom;

  const card = getAchievementDisplayName(raw, loc);
  if (
    card &&
    card !== "إنجاز بدون عنوان" &&
    card !== "Untitled achievement" &&
    !isLikelyMongoObjectId(card)
  ) {
    if (isLikelyTechnicalSlug(card)) return labelAchievementSlugOrKey(card, loc);
    return card;
  }

  const slugSource =
    safeTrim(raw.achievementName) ||
    safeTrim(raw.title) ||
    safeTrim(raw.nameEn) ||
    safeTrim(raw.nameAr) ||
    safeTrim(raw.achievementType);
  if (slugSource && isLikelyTechnicalSlug(slugSource)) {
    return labelAchievementSlugOrKey(slugSource, loc);
  }

  const typeLabel = getAchievementTypeLabel(raw.achievementType, loc);
  if (typeLabel !== studentNotSpecified(loc)) return typeLabel;

  return loc === "ar" ? "إنجاز غير محدد" : "Unspecified Achievement";
};

const DANGEROUS_PROTOCOL = /^\s*javascript:/i;

/**
 * Normalize attachment/evidence URLs for browser open/download (absolute http(s), data:, site-relative).
 */
export const resolveStudentAttachmentHref = (raw: unknown, baseOrigin?: string): string | null => {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || DANGEROUS_PROTOCOL.test(s)) return null;

  if (s.startsWith("data:")) {
    return s.length >= 30 ? s : null;
  }

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      if (isNonRenderableAttachmentHref(u.href)) return null;
      return u.href;
    } catch {
      return null;
    }
  }

  if (s.startsWith("//")) {
    const proto = baseOrigin?.startsWith("http://") ? "http:" : "https:";
    try {
      const full = `${proto}${s}`;
      new URL(full);
      return full;
    } catch {
      return null;
    }
  }

  let path = s;
  if (!path.startsWith("/")) {
    path = `/${path.replace(/^\/+/, "")}`;
  }

  if (path.startsWith("/api/")) return null;

  return path;
};

export const studentFormatLevel = (v: unknown, loc: Loc): string => {
  const s = safeTrim(v);
  if (!s) return studentNotSpecified(loc);
  return getAchievementLevelLabel(s, loc);
};

/** Organizer / event host line — never show raw competition slugs when mappable. */
export const studentFormatOrganizer = (raw: Record<string, unknown>, loc: Loc): string | null => {
  const o = formatOrgLabel(raw, loc);
  if (!o || o === "—") return null;
  if (loc === "ar" && o === "غير محدد") return null;
  if (isLikelyTechnicalSlug(o) && !isArabicText(o)) return labelAchievementSlugOrKey(o, loc);
  return o;
};

export const studentFormatResultTypeLabel = (v: unknown, loc: Loc): string => {
  const s = safeTrim(v);
  if (!s) return studentNotSpecified(loc);
  return getResultTypeLabel(s, loc);
};

export const studentFormatResultLine = (
  input: {
    resultType?: string;
    medalType?: string;
    rank?: string;
    resultValue?: string;
  },
  loc: Loc
): string => {
  const rt = safeTrim(input.resultType);
  const medal = safeTrim(input.medalType);
  const rank = safeTrim(input.rank);
  const rv = safeTrim(input.resultValue);
  const scoreNum =
    rt === "score" && rv !== ""
      ? Number(rv)
      : rt === "score" && medal !== ""
        ? Number(medal)
        : NaN;
  const scoreVal = Number.isFinite(scoreNum) ? scoreNum : undefined;

  if (!rt && !medal && !rank && !rv) return studentNotSpecified(loc);

  let line = formatLocalizedResultLine(
    rt || undefined,
    medal || undefined,
    rank || undefined,
    loc,
    scoreVal
  );

  if (!line || line === "—") return studentNotSpecified(loc);

  for (const p of [rt, medal, rank, rv].filter(Boolean)) {
    if (isLikelyTechnicalSlug(p) && line.includes(p)) {
      line = line.split(p).join(labelAchievementSlugOrKey(p, loc));
    }
  }

  if (isLikelyTechnicalSlug(line.replace(/\s+/g, "_"))) {
    return labelAchievementSlugOrKey(line, loc);
  }

  return line;
};

export const studentFormatCertificateStatus = (
  status: string | undefined,
  loc: Loc
): string => {
  const s = safeTrim(status) as CertificateUiStatus;
  if (s === "issued" || s === "not_available" || s === "revoked") {
    return labelCertificateUiStatus(s, loc);
  }
  return studentNotSpecified(loc);
};

/** True when a string should not appear as human-readable description body text. */
export const looksLikeFileOrMachinePayload = (value: unknown): boolean => {
  const t = safeTrim(value);
  if (!t) return false;
  if (t.startsWith("data:")) return true;
  if (/^https?:\/\//i.test(t)) {
    if (t.length >= 80) return true;
    if (/\.(pdf|png|jpe?g|jpeg|webp|gif|docx?|xlsx?)(\?|#|$)/i.test(t)) return true;
  }
  if (t.startsWith("/") || t.startsWith("./") || t.startsWith("../")) {
    if (t.length >= 160) return true;
    if (/\.(pdf|png|jpe?g|jpeg|webp|gif)(\?|#|$)/i.test(t)) return true;
  }
  if (/^[A-Za-z]:\\/.test(t)) return true;
  if (t.includes("/uploads/") || t.includes("storage.googleapis.com")) return true;
  if (t.length >= 320 && !/\s/.test(t)) return true;
  if (t.length >= 500 && /^[A-Za-z0-9+/=\s_-]+$/.test(t)) return true;
  return false;
};

const scrubMachineTokensFromReadableBlock = (text: string): string => {
  const lines = text.split(/\r?\n/).map((line) =>
    line
      .split(/\s+/)
      .filter((tok) => tok !== "" && !looksLikeFileOrMachinePayload(tok))
      .join(" ")
      .trim()
  );
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Split description into human text vs file-like strings so URLs/data never render as body copy.
 */
export const partitionStudentAchievementDescription = (
  raw: unknown
): { readable: string | null; derivedFileStrings: string[] } => {
  const s = safeTrim(raw);
  if (!s) return { readable: null, derivedFileStrings: [] };

  if (looksLikeFileOrMachinePayload(s)) {
    return { readable: null, derivedFileStrings: [s] };
  }

  const derived: string[] = [];
  const keptLines: string[] = [];

  for (const line of s.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      keptLines.push("");
      continue;
    }
    if (looksLikeFileOrMachinePayload(line)) {
      derived.push(trimmed);
    } else {
      keptLines.push(line);
    }
  }

  let readableText = keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (readableText) {
    readableText = scrubMachineTokensFromReadableBlock(readableText);
  }
  const readable = readableText.trim() || null;

  return { readable, derivedFileStrings: derived };
};

export const studentFormatDescription = (raw: unknown, loc: Loc): string | null => {
  void loc;
  return partitionStudentAchievementDescription(raw).readable;
};

/** Dedupe; omit strings equal to excludeUrl (e.g. primary evidence URL shown elsewhere). */
export const mergeStudentDetailAttachmentSources = (
  derivedFromDescription: string[],
  attachments: unknown[] | undefined,
  excludeUrl?: string
): string[] => {
  const ex = safeTrim(excludeUrl);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (x: string) => {
    const t = x.trim();
    if (!t || seen.has(t)) return;
    if (ex && t === ex) return;
    seen.add(t);
    out.push(t);
  };
  for (const d of derivedFromDescription) push(d);
  if (Array.isArray(attachments)) {
    for (const a of attachments) {
      const u = extractAttachmentUrl(a);
      if (u) push(u);
    }
  }
  return out;
};

export type AttachmentRow = {
  /** Resolved URL for navigation; null when invalid (show unavailable message only). */
  href: string | null;
  canOpen: boolean;
  /** Optional display name from structured attachment. */
  displayName?: string;
  /**
   * Suggested filename for `download` on data: URLs only — never shown in the UI.
   */
  dataDownloadName?: string;
};

/** Suggested download filename for data: URLs — not shown in the UI. */
export const studentDataUrlDownloadName = (dataHref: string): string => {
  const m = /^data:([^;]+);/i.exec(dataHref);
  const mime = (m?.[1] || "").toLowerCase();
  if (mime.includes("pdf")) return "document.pdf";
  if (mime.includes("png")) return "image.png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "image.jpg";
  if (mime.includes("gif")) return "image.gif";
  if (mime.includes("webp")) return "image.webp";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("sheet"))
    return "document.xlsx";
  if (mime.includes("word") || mime.includes("document")) return "document.docx";
  return "file";
};

export const buildAttachmentRow = (
  raw: unknown,
  _index: number,
  _loc: Loc,
  baseOrigin?: string
): AttachmentRow | null => {
  void _index;
  void _loc;
  const s = extractAttachmentUrl(raw);
  if (!s) return null;

  const displayName =
    raw && typeof raw === "object" && typeof (raw as { name?: unknown }).name === "string"
      ? String((raw as { name: string }).name).trim() || undefined
      : undefined;

  const resolved = resolveStudentAttachmentHref(s, baseOrigin);
  const canOpen = Boolean(resolved);

  const dataDownloadName =
    resolved && resolved.startsWith("data:") ? studentDataUrlDownloadName(resolved) : undefined;

  return {
    href: resolved,
    canOpen,
    displayName,
    dataDownloadName,
  };
};
