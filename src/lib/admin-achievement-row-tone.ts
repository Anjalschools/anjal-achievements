import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";

export type AchievementRowToneVariant = "default" | "all_tab";

/**
 * Subtle row background for admin achievement tables (light theme).
 * `all_tab`: only pending (لم تُراجع بعد) stays neutral; other states keep tint. Badges unchanged elsewhere.
 */
export const buildAchievementWorkflowRowClassName = (
  status: WorkflowDisplayStatus,
  variant: AchievementRowToneVariant = "default"
): string => {
  const all = variant === "all_tab";
  switch (status) {
    case "approved":
    case "featured":
      return all
        ? "bg-emerald-50 hover:bg-emerald-100/90"
        : "bg-emerald-50/50 hover:bg-emerald-50/70";
    case "rejected":
      return all ? "bg-red-50 hover:bg-red-100/85" : "bg-red-50/45 hover:bg-red-50/60";
    case "needs_revision":
      return all ? "bg-amber-50 hover:bg-amber-100/80" : "bg-amber-50/40 hover:bg-amber-50/55";
    case "pending_re_review":
      return all ? "bg-sky-50 hover:bg-sky-100/85" : "bg-sky-50/35 hover:bg-sky-50/50";
    case "pending":
      if (variant === "all_tab") return "";
      return "bg-slate-50/30 hover:bg-slate-100/45";
    default:
      if (variant === "all_tab") return "";
      return "bg-slate-50/30 hover:bg-slate-100/45";
  }
};
