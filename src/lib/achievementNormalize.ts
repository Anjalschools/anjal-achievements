/**
 * Normalization helpers for achievements (display + form). No DB mutation.
 */

import { resolveWorkflowDisplayStatus } from "@/lib/achievementWorkflow";

export type ApprovalStatusNormalized =
  | "pending"
  | "needs_revision"
  | "approved"
  | "featured"
  | "pending_re_review"
  | "rejected"
  | "unreviewed";

export const isArabicText = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== "string") return false;
  const t = value.trim();
  if (!t) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(t);
};

export type AchievementLike = Record<string, unknown> & {
  nameAr?: string;
  nameEn?: string;
  arabicName?: string;
  englishName?: string;
  name?: string;
  title?: string;
  achievementName?: string;
  customAchievementName?: string;
  featured?: boolean;
  approved?: boolean;
  status?: string;
  isFeatured?: boolean;
  verificationStatus?: string;
  pendingReReview?: boolean;
};

export const normalizeAchievementNames = (raw: AchievementLike) => {
  const name =
    (typeof raw.name === "string" && raw.name.trim()) ||
    (typeof raw.title === "string" && raw.title.trim()) ||
    (typeof raw.achievementName === "string" && raw.achievementName.trim()) ||
    "";

  const normalizedNameAr =
    (typeof raw.nameAr === "string" && raw.nameAr.trim()) ||
    (typeof raw.arabicName === "string" && raw.arabicName.trim()) ||
    (isArabicText(name) ? name : "") ||
    (isArabicText(typeof raw.title === "string" ? raw.title : "") ? String(raw.title).trim() : "") ||
    (isArabicText(String(raw.achievementName || "")) ? String(raw.achievementName).trim() : "");

  const normalizedNameEn =
    (typeof raw.nameEn === "string" && raw.nameEn.trim()) ||
    (typeof raw.englishName === "string" && raw.englishName.trim()) ||
    (!isArabicText(name) && name ? name : "") ||
    (!isArabicText(String(raw.title || "")) && typeof raw.title === "string" ? raw.title.trim() : "") ||
    (!isArabicText(String(raw.achievementName || "")) && typeof raw.achievementName === "string"
      ? raw.achievementName.trim()
      : "");

  const normalizedDisplayName =
    normalizedNameAr ||
    normalizedNameEn ||
    (typeof raw.customAchievementName === "string" && raw.customAchievementName.trim()) ||
    name ||
    (typeof raw.title === "string" && raw.title.trim()) ||
    (typeof raw.achievementName === "string" && raw.achievementName.trim()) ||
    "إنجاز";

  return { normalizedNameAr, normalizedNameEn, normalizedDisplayName };
};

/** Single visible "اسم الإنجاز" value per UI locale */
export const displayNameForLocale = (names: ReturnType<typeof normalizeAchievementNames>, locale: "ar" | "en") =>
  locale === "ar"
    ? names.normalizedNameAr || names.normalizedNameEn || names.normalizedDisplayName
    : names.normalizedNameEn || names.normalizedNameAr || names.normalizedDisplayName;

export const inferAchievementCategoryFromLegacyType = (achievementType: string | undefined): string => {
  const t = String(achievementType || "").toLowerCase();
  if (t === "program" || t === "excellence_program") return "program";
  if (t === "exhibition") return "exhibition";
  return "competition";
};

/** Map legacy Qudrat `achievementName` (e.g. "99", "100") to tier slugs used in scoring/UI. */
export const normalizeLegacyQudratAchievementName = (raw: string | undefined | null): string => {
  const s = String(raw ?? "").trim();
  if (!s) return s;
  const lower = s.toLowerCase();
  if (/^qudrat_\d{2,3}$/.test(lower)) return lower;
  const m = s.match(/^(\d{2}|100)$/);
  if (m) return `qudrat_${m[1]}`;
  return s;
};

export const normalizeApprovalStatus = (raw: AchievementLike): ApprovalStatusNormalized => {
  const a = raw as Record<string, unknown>;
  const ex = a.approvalStatus;
  if (
    ex === "featured" ||
    ex === "approved" ||
    ex === "pending" ||
    ex === "needs_revision" ||
    ex === "pending_re_review" ||
    ex === "rejected" ||
    ex === "unreviewed"
  ) {
    return ex;
  }
  const mapped = resolveWorkflowDisplayStatus(raw);
  if (mapped === "featured") return "featured";
  if (mapped === "approved") return "approved";
  if (mapped === "needs_revision") return "needs_revision";
  if (mapped === "pending_re_review") return "pending_re_review";
  if (mapped === "rejected") return "rejected";
  return "pending";
};

const isValidHttpUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export const isRenderableImageUrl = (s: string | undefined | null): boolean => {
  if (!s || typeof s !== "string") return false;
  const v = s.trim();
  if (v.startsWith("data:image/")) return true;
  if (v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://")) return true;
  return false;
};

export const normalizeAchievementImage = (raw: AchievementLike): string | null => {
  const a = raw as Record<string, unknown>;
  for (const key of ["image", "proofImage", "thumbnail", "evidenceImage"] as const) {
    const c = a[key];
    if (typeof c === "string" && c.trim() && isRenderableImageUrl(c)) return c.trim();
  }
  const ev = a.evidenceUrl;
  if (typeof ev === "string" && ev.trim() && isRenderableImageUrl(ev)) return ev.trim();
  const pl = a.proofLink;
  if (typeof pl === "string" && isValidHttpUrl(pl.trim())) return pl.trim();
  return null;
};

/** First string attachment URL / base64 from legacy fields */
export const normalizeProofAttachment = (raw: AchievementLike): { url: string | null; label: string } => {
  const a = raw as Record<string, unknown>;
  const att = a.attachments;
  if (Array.isArray(att) && att.length > 0 && typeof att[0] === "string") {
    return { url: att[0], label: "attachment" };
  }
  const pf = a.proofFile ?? a.evidenceFile;
  if (typeof pf === "string" && pf.trim()) return { url: pf.trim(), label: String(a.evidenceFileName || "file") };
  return { url: null, label: "" };
};

/** YYYY-MM-DD for inputs */
export const achievementDateIsoFromRecord = (raw: AchievementLike): string => {
  const d = raw.date as Date | string | undefined;
  const y = raw.achievementYear as number | undefined;
  if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString().split("T")[0];
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  if (typeof y === "number" && y > 1900) return `${y}-01-01`;
  return new Date().toISOString().split("T")[0];
};

/** Map legacy resultValue free text to medalType / rank when subtype empty */
export const absorbResultValueIntoSubtypes = (
  resultType: string,
  resultValue: string | undefined,
  medalType: string | undefined,
  rank: string | undefined
): { medalType?: string; rank?: string } => {
  const rv = String(resultValue || "").toLowerCase().trim();
  const mt = String(medalType || "").toLowerCase();
  const rk = String(rank || "").toLowerCase();
  if (resultType === "medal") {
    if (mt) return { medalType: mt };
    if (["gold", "ذهب", "ذهبية"].some((x) => rv.includes(x))) return { medalType: "gold" };
    if (["silver", "فضة", "فضية"].some((x) => rv.includes(x))) return { medalType: "silver" };
    if (["bronze", "برونز", "برونزية"].some((x) => rv.includes(x))) return { medalType: "bronze" };
    if (rv === "gold" || rv === "silver" || rv === "bronze") return { medalType: rv };
    return {};
  }
  if (resultType === "rank") {
    if (rk) return { rank: rk };
    if (rv.includes("أول") || rv.includes("first") || rv.includes("1")) return { rank: "first" };
    if (rv.includes("ثان") || rv.includes("second") || rv === "2") return { rank: "second" };
    if (rv.includes("ثالث") || rv.includes("third") || rv === "3") return { rank: "third" };
    if (["first", "second", "third", "fourth", "fifth"].includes(rv)) return { rank: rv };
  }
  return {};
};

export const isAchievementLocked = (s: ApprovalStatusNormalized) => s === "approved" || s === "featured";
