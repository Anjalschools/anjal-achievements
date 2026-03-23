import type { AdminAchievementListSortKey } from "@/lib/admin-achievement-list-sort";
import type { AdminReviewTab } from "@/types/admin-achievement-review";

const TAB_SET = new Set<string>([
  "all",
  "pending",
  "needs_revision",
  "approved",
  "featured",
  "pending_re_review",
  "ai_flagged",
  "duplicate",
  "level_mismatch",
  "attachment_ai_mismatch",
  "attachment_ai_unclear",
  "attachment_ai_match",
  "no_attachments",
  "admin_duplicate_marked",
  "rejected",
]);

const LIST_SORT_KEYS = new Set<string>(["default", "student", "title", "level", "review"]);

const AI_SORT_KEYS = new Set<string>(["severity", "student", "title", "level", "overall", "review"]);

export type ParsedReviewQuery = {
  tab?: AdminReviewTab;
  page?: number;
  q?: string;
  sort?: AdminAchievementListSortKey;
  sortAsc?: boolean;
  aiSort?: string;
  aiSortAsc?: boolean;
};

export const parseReviewListQueryString = (raw: string | null): ParsedReviewQuery => {
  const out: ParsedReviewQuery = {};
  if (!raw || !raw.trim()) return out;
  let s = raw.trim();
  if (s.startsWith("?")) s = s.slice(1);
  const sp = new URLSearchParams(s);

  const tab = sp.get("tab");
  if (tab && TAB_SET.has(tab)) out.tab = tab as AdminReviewTab;

  const page = sp.get("page");
  if (page) {
    const n = parseInt(page, 10);
    if (!Number.isNaN(n) && n >= 1) out.page = n;
  }

  const q = sp.get("q");
  if (q) out.q = q;

  const sort = sp.get("sort");
  if (sort && LIST_SORT_KEYS.has(sort)) out.sort = sort as AdminAchievementListSortKey;

  const sortDir = sp.get("sortDir");
  if (sortDir === "desc") out.sortAsc = false;
  else if (sortDir === "asc") out.sortAsc = true;

  const aiSort = sp.get("aiSort");
  if (aiSort && AI_SORT_KEYS.has(aiSort)) out.aiSort = aiSort;

  const aiSortDir = sp.get("aiSortDir");
  if (aiSortDir === "desc") out.aiSortAsc = false;
  else if (aiSortDir === "asc") out.aiSortAsc = true;

  return out;
};

export const decodeReturnToParam = (returnTo: string | null | undefined): ParsedReviewQuery => {
  if (!returnTo) return {};
  try {
    const decoded = decodeURIComponent(returnTo.trim());
    return parseReviewListQueryString(decoded);
  } catch {
    return {};
  }
};

export type BuildReturnToInput = {
  tab: string;
  page: number;
  q: string;
  allListSortKey: AdminAchievementListSortKey;
  allListSortAsc: boolean;
  aiSortKey: string;
  aiSortAsc: boolean;
};

export const buildReturnToQueryString = (input: BuildReturnToInput): string => {
  const sp = new URLSearchParams();
  sp.set("tab", input.tab);
  sp.set("page", String(Math.max(1, input.page)));
  const q = input.q.trim();
  if (q) sp.set("q", q);
  if (input.tab === "all" && input.allListSortKey !== "default") {
    sp.set("sort", input.allListSortKey);
    sp.set("sortDir", input.allListSortAsc ? "asc" : "desc");
  }
  if (input.tab === "ai_flagged") {
    if (input.aiSortKey && input.aiSortKey !== "severity") {
      sp.set("aiSort", input.aiSortKey);
      sp.set("aiSortDir", input.aiSortAsc ? "asc" : "desc");
    }
  }
  return sp.toString();
};

export const buildAchievementDetailHref = (achievementId: string, returnToQs: string): string => {
  const enc = encodeURIComponent(returnToQs);
  return `/admin/achievements/review/${achievementId}?returnTo=${enc}`;
};
