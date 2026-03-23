/**
 * Client-side sort for admin achievement list (current page), e.g. tab "all".
 */

import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import { formatAchievementLevelLabel, resolveAchievementTitleForAdmin } from "@/lib/admin-achievement-labels";

export type AdminAchievementListSortKey = "default" | "student" | "title" | "level" | "review";

export const workflowStatusSortRank = (s: WorkflowDisplayStatus): number => {
  switch (s) {
    case "pending":
      return 0;
    case "needs_revision":
      return 1;
    case "pending_re_review":
      return 2;
    case "approved":
      return 3;
    case "featured":
      return 4;
    case "rejected":
      return 5;
    default:
      return 99;
  }
};

export type AdminAchievementListSortableRow = {
  id: string;
  approvalStatus: WorkflowDisplayStatus;
  student: { fullName: string };
  achievementLevel?: string;
} & Record<string, unknown>;

export const compareAdminAchievementListRows = (
  a: AdminAchievementListSortableRow,
  b: AdminAchievementListSortableRow,
  key: AdminAchievementListSortKey,
  asc: boolean,
  loc: "ar" | "en"
): number => {
  const dir = asc ? 1 : -1;
  const tie = String(a.id).localeCompare(String(b.id));

  if (key === "default") return 0;

  if (key === "review") {
    const c = workflowStatusSortRank(a.approvalStatus) - workflowStatusSortRank(b.approvalStatus);
    if (c !== 0) return c * dir;
    return tie;
  }

  if (key === "student") {
    const sa = (a.student?.fullName || "").toLocaleLowerCase(loc === "ar" ? "ar" : "en");
    const sb = (b.student?.fullName || "").toLocaleLowerCase(loc === "ar" ? "ar" : "en");
    const c = sa.localeCompare(sb, undefined, { sensitivity: "base" });
    if (c !== 0) return c * dir;
    return tie;
  }

  if (key === "title") {
    const ta = resolveAchievementTitleForAdmin(a, loc).toLocaleLowerCase(loc === "ar" ? "ar" : "en");
    const tb = resolveAchievementTitleForAdmin(b, loc).toLocaleLowerCase(loc === "ar" ? "ar" : "en");
    const c = ta.localeCompare(tb, undefined, { sensitivity: "base" });
    if (c !== 0) return c * dir;
    return tie;
  }

  const la = formatAchievementLevelLabel(String(a.achievementLevel || ""), loc).toLocaleLowerCase(
    loc === "ar" ? "ar" : "en"
  );
  const lb = formatAchievementLevelLabel(String(b.achievementLevel || ""), loc).toLocaleLowerCase(
    loc === "ar" ? "ar" : "en"
  );
  const c = la.localeCompare(lb, undefined, { sensitivity: "base" });
  if (c !== 0) return c * dir;
  return tie;
};
