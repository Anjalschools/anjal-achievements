/**
 * Phase P.1.0.1 — one-time legacy portfolio evidence visibility backfill.
 * Pure helpers (no server-only) for scripts and tests.
 */

import {
  coerceAttachmentForStorage,
  type AchievementAttachmentObject,
} from "@/lib/achievement-attachments";
import { publicPortfolioPublishedAchievementFilter } from "@/lib/public-portfolio-filters";

/** Default P.1 deploy boundary; override with PORTFOLIO_EVIDENCE_P1_LAUNCH_AT in production. */
export const DEFAULT_PORTFOLIO_EVIDENCE_P1_LAUNCH_AT = "2026-06-18T00:00:00.000Z";

export const LEGACY_EVIDENCE_BACKFILL_BATCH_DEFAULT = 50;

export type LegacyEvidenceBackfillStats = {
  achievementsScanned: number;
  achievementsSkipped: number;
  achievementsUpdated: number;
  attachmentsUpdated: number;
  batchErrors: number;
};

export const resolvePortfolioEvidenceP1LaunchAt = (
  raw: string | undefined = process.env.PORTFOLIO_EVIDENCE_P1_LAUNCH_AT
): Date => {
  const value = String(raw || DEFAULT_PORTFOLIO_EVIDENCE_P1_LAUNCH_AT).trim();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid PORTFOLIO_EVIDENCE_P1_LAUNCH_AT: ${value}`);
  }
  return parsed;
};

/** Mirrors `publicPortfolioPublishedAchievementFilter` for lean achievement rows. */
export const isAchievementApprovedForPublicPortfolio = (row: Record<string, unknown>): boolean => {
  if (row.pendingReReview === true) return false;

  const status = String(row.status ?? "").trim();
  if (status === "rejected") return false;

  const achievementPortfolioHidden = row.showInPublicPortfolio === false;
  if (achievementPortfolioHidden) return false;

  const legacyApproved = row.approved === true;
  if (status === "approved") return true;
  if (legacyApproved && !status) return true;

  return false;
};

export const isPreP1Achievement = (
  row: Record<string, unknown>,
  launchAt: Date
): boolean => {
  const createdAt = row.createdAt;
  if (!(createdAt instanceof Date) && typeof createdAt !== "string") return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() < launchAt.getTime();
};

/** True when admin has explicitly set attachment-level public visibility (post-P.1). */
export const attachmentHasExplicitPublicVisibility = (raw: unknown): boolean => {
  if (typeof raw === "string") return false;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return Object.prototype.hasOwnProperty.call(raw, "showInPublicPortfolio");
};

export const backfillLegacyAttachmentItem = (
  raw: unknown
): { item: AchievementAttachmentObject | unknown; changed: boolean } => {
  if (attachmentHasExplicitPublicVisibility(raw)) {
    return { item: raw, changed: false };
  }

  const coerced = coerceAttachmentForStorage(raw);
  if (!coerced) {
    return { item: raw, changed: false };
  }

  const base =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};

  const next: AchievementAttachmentObject = {
    ...base,
    url: coerced.url,
    mimeType: coerced.mimeType,
    name: coerced.name,
    ...(coerced.key ? { key: coerced.key } : {}),
    ...(coerced.provider ? { provider: coerced.provider } : {}),
    ...(coerced.size !== undefined ? { size: coerced.size } : {}),
    ...(coerced.evidenceCategory ? { evidenceCategory: coerced.evidenceCategory } : {}),
    approved: true,
    showInPublicPortfolio: true,
  };

  return { item: next, changed: true };
};

export const backfillLegacyAttachmentsArray = (
  raw: unknown
): { next: unknown[]; attachmentsUpdated: number; changed: boolean } => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { next: [], attachmentsUpdated: 0, changed: false };
  }

  let attachmentsUpdated = 0;
  let changed = false;
  const next: unknown[] = [];

  for (const item of raw) {
    const result = backfillLegacyAttachmentItem(item);
    if (result.changed) {
      attachmentsUpdated += 1;
      changed = true;
    }
    next.push(result.item);
  }

  return { next, attachmentsUpdated, changed };
};

export type LegacyEvidenceBackfillPlan =
  | { action: "skip"; reason: "not_approved" | "post_p1" | "no_attachments" | "no_changes" }
  | {
      action: "update";
      attachmentsUpdated: number;
      attachments: unknown[];
    };

export const planLegacyEvidenceBackfillForAchievement = (
  row: Record<string, unknown>,
  launchAt: Date
): LegacyEvidenceBackfillPlan => {
  if (!isAchievementApprovedForPublicPortfolio(row)) {
    return { action: "skip", reason: "not_approved" };
  }
  if (!isPreP1Achievement(row, launchAt)) {
    return { action: "skip", reason: "post_p1" };
  }

  const attachmentsRaw = row.attachments;
  if (!Array.isArray(attachmentsRaw) || attachmentsRaw.length === 0) {
    return { action: "skip", reason: "no_attachments" };
  }

  const { next, attachmentsUpdated, changed } = backfillLegacyAttachmentsArray(attachmentsRaw);
  if (!changed) {
    return { action: "skip", reason: "no_changes" };
  }

  return {
    action: "update",
    attachmentsUpdated,
    attachments: next,
  };
};

/** Mongo filter: approved portfolio achievements created before P.1 with attachments. */
export const buildLegacyEvidenceBackfillQuery = (launchAt: Date): Record<string, unknown> => {
  const approved = publicPortfolioPublishedAchievementFilter();
  const approvedAnd = Array.isArray(approved.$and) ? approved.$and : [];

  return {
    $and: [
      ...approvedAnd,
      { createdAt: { $lt: launchAt } },
      { attachments: { $exists: true, $type: "array", $ne: [] } },
    ],
  };
};

export const createEmptyLegacyEvidenceBackfillStats = (): LegacyEvidenceBackfillStats => ({
  achievementsScanned: 0,
  achievementsSkipped: 0,
  achievementsUpdated: 0,
  attachmentsUpdated: 0,
  batchErrors: 0,
});
