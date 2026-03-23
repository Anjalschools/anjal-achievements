import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";

type AchievementStatusBadgeProps = {
  status: WorkflowDisplayStatus;
  locale?: "ar" | "en";
  className?: string;
};

const labels: Record<WorkflowDisplayStatus, { ar: string; en: string }> = {
  pending: { ar: "قيد المراجعة", en: "Pending review" },
  needs_revision: { ar: "يحتاج تعديل", en: "Needs revision" },
  approved: { ar: "معتمد", en: "Approved" },
  featured: { ar: "مميز", en: "Featured" },
  pending_re_review: { ar: "إعادة مراجعة", en: "Re-review" },
  rejected: { ar: "مرفوض", en: "Rejected" },
};

const styles: Record<WorkflowDisplayStatus, string> = {
  pending: "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80",
  needs_revision: "bg-orange-100 text-orange-950 ring-1 ring-orange-200/90",
  approved: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80",
  featured: "bg-amber-200/90 text-amber-950 ring-1 ring-amber-400/70",
  pending_re_review: "bg-sky-100 text-sky-950 ring-1 ring-sky-200/90",
  rejected: "bg-red-100 text-red-950 ring-1 ring-red-300/90",
};

const AchievementStatusBadge = ({
  status,
  locale = "ar",
  className = "",
}: AchievementStatusBadgeProps) => {
  const label = labels[status][locale === "ar" ? "ar" : "en"];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]} ${className}`}
    >
      {label}
    </span>
  );
};

export default AchievementStatusBadge;
