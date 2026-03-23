/**
 * Human-facing "attachment AI verdict" for admin lists + AI queue visibility rules.
 */

import { DUPLICATE_FLAG, LEVEL_MISMATCH_FLAG } from "@/lib/achievement-review-rules";
import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import type { UiTone } from "@/lib/admin-ai-alert-review-view-model";

export type AdminAttachmentAiDecisionInput = {
  adminAttachmentOverall?: string | null;
  adminAttachmentAiReview?: Record<string, unknown> | null;
  adminDuplicateMarked?: boolean;
  aiFlags?: string[];
  aiReviewStatus?: string;
  pendingReReview?: boolean;
  /** When set (e.g. list row), used with signals for queue visibility. */
  approvalStatus?: WorkflowDisplayStatus;
};

const norm = (v: unknown): string => String(v ?? "").trim().toLowerCase();

const checkRaw = (checks: Record<string, unknown> | undefined, key: string): string | null => {
  if (!checks) return null;
  const v = checks[key];
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "match" || s === "mismatch" || s === "unclear") return s;
  return null;
};

const anyCheckMismatchOrUnclear = (checks: Record<string, unknown> | undefined): boolean => {
  if (!checks) return false;
  for (const k of ["nameCheck", "yearCheck", "levelCheck", "achievementCheck"] as const) {
    const r = checkRaw(checks, k);
    if (r === "mismatch" || r === "unclear") return true;
  }
  return false;
};

export const resolveAdminAttachmentOverall = (input: AdminAttachmentAiDecisionInput): string | null => {
  const o0 = norm(input.adminAttachmentOverall);
  if (o0 === "match" || o0 === "mismatch" || o0 === "unclear") return o0;
  const ar = input.adminAttachmentAiReview;
  if (ar && typeof ar === "object") {
    const o1 = norm((ar as { overallMatchStatus?: string }).overallMatchStatus);
    if (o1 === "match" || o1 === "mismatch" || o1 === "unclear") return o1;
  }
  return null;
};

/** True when attachment AI / duplicate / legacy AI signals still warrant admin attention beyond a plain "match". */
export const needsAttachmentAiFollowUp = (input: AdminAttachmentAiDecisionInput): boolean => {
  if (input.adminDuplicateMarked === true) return true;
  if (norm(input.aiReviewStatus) === "flagged") return true;
  const flags = Array.isArray(input.aiFlags) ? input.aiFlags : [];
  if (flags.includes(DUPLICATE_FLAG) || flags.includes(LEVEL_MISMATCH_FLAG)) return true;
  const ar = input.adminAttachmentAiReview;
  if (ar && typeof ar === "object") {
    const checks = (ar as { checks?: Record<string, unknown> }).checks;
    if (anyCheckMismatchOrUnclear(checks)) return true;
  }
  return false;
};

/**
 * Column copy for admin "All" tab — never raw enums; reflects match + residual risk.
 */
export const buildAdminAttachmentAiDecisionColumn = (
  input: AdminAttachmentAiDecisionInput,
  loc: "ar" | "en"
): { label: string; tone: UiTone } => {
  const overall = resolveAdminAttachmentOverall(input);
  const followUp = needsAttachmentAiFollowUp(input);

  if (overall === "mismatch") {
    return { label: loc === "ar" ? "غير مطابق" : "Not aligned", tone: "danger" };
  }
  if (overall === "unclear") {
    return { label: loc === "ar" ? "غير واضح" : "Unclear", tone: "warning" };
  }
  if (overall === "match") {
    if (followUp) {
      return { label: loc === "ar" ? "يحتاج مراجعة" : "Needs review", tone: "warning" };
    }
    return { label: loc === "ar" ? "مطابق" : "Aligned", tone: "success" };
  }
  if (followUp) {
    return { label: loc === "ar" ? "يحتاج مراجعة" : "Needs review", tone: "warning" };
  }
  return { label: loc === "ar" ? "لم يُحلل بعد" : "Not analyzed yet", tone: "muted" };
};

/** Same OR-signals as `buildAdminAchievementListFilter("ai_flagged")` (without workflow gate). */
export const achievementMatchesAiQueueSignals = (input: AdminAttachmentAiDecisionInput): boolean => {
  const overall = resolveAdminAttachmentOverall(input);
  if (overall === "mismatch" || overall === "unclear") return true;
  if (norm(input.aiReviewStatus) === "flagged") return true;
  if (input.adminDuplicateMarked === true) return true;
  const flags = Array.isArray(input.aiFlags) ? input.aiFlags : [];
  if (flags.includes(DUPLICATE_FLAG) || flags.includes(LEVEL_MISMATCH_FLAG)) return true;
  return false;
};

/**
 * Client + docs: should this row appear in the "فحص الذكاء الاصطناعي" work queue?
 * Terminal positive workflow (approved/featured without re-review) or rejected => out.
 */
export const shouldShowInAiFlaggedTab = (
  input: AdminAttachmentAiDecisionInput & { approvalStatus?: WorkflowDisplayStatus }
): boolean => {
  const st = input.approvalStatus;
  if (st === "rejected") return false;
  if ((st === "approved" || st === "featured") && !input.pendingReReview) return false;
  return achievementMatchesAiQueueSignals(input);
};
