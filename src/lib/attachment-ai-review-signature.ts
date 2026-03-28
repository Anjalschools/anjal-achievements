/**
 * Fingerprint achievement + evidence inputs for attachment AI invalidation / skip-if-unchanged.
 */

import { createHash } from "crypto";
import { extractAttachmentUrl } from "@/lib/achievement-attachments";

const trunc = (v: unknown, n = 200): string => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.startsWith("data:")) {
    const i = s.indexOf("base64,");
    if (i !== -1) return `data:${s.slice(5, Math.min(40, i))}...b64len=${s.length - i - 7}`;
    return s.slice(0, 80);
  }
  return s.length <= n ? s : `${s.slice(0, n)}…`;
};

const norm = (v: unknown): string => String(v ?? "").trim().toLowerCase();

const attachmentFingerprints = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const u = extractAttachmentUrl(item);
    if (u) out.push(trunc(u, 240));
  }
  return [...out].sort();
};

/** True when there is something the attachment AI pipeline can try to analyze. */
export const hasAnalyzableAttachmentEvidence = (a: Record<string, unknown>): boolean => {
  if (a.requiresCommitteeReview === true) return false;
  const img = String(a.image || "").trim();
  const ev = String(a.evidenceUrl || "").trim();
  const atts = a.attachments;
  if (img || ev) return true;
  if (Array.isArray(atts) && atts.length > 0) return true;
  return false;
};

export const computeAiReviewInputSignature = (a: Record<string, unknown>): string => {
  const payload = {
    image: trunc(a.image),
    evidenceUrl: trunc(a.evidenceUrl),
    evidenceFileName: norm(a.evidenceFileName),
    attachments: attachmentFingerprints(a.attachments),
    nameAr: norm(a.nameAr),
    nameEn: norm(a.nameEn),
    achievementName: norm(a.achievementName),
    customAchievementName: norm(a.customAchievementName),
    title: norm(a.title),
    medalType: norm(a.medalType),
    rank: norm(a.rank),
    resultType: norm(a.resultType),
    resultValue: norm(a.resultValue),
    achievementLevel: norm(a.achievementLevel),
    level: norm(a.level),
    achievementYear: a.achievementYear,
    achievementDate: norm(a.achievementDate),
    date: a.date instanceof Date ? a.date.toISOString().slice(0, 10) : norm(a.date),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
};
