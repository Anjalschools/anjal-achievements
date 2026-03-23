import {
  getAchievementDisplayName,
  getAchievementLevelLabel,
  getAchievementScoreDisplay,
} from "@/lib/achievementDisplay";
import {
  getDashboardAchievementCategoryLine,
  labelCertificateUiStatus,
  type AchievementLabelLocale,
} from "@/lib/achievement-labels";
import { resolveWorkflowDisplayStatus, type WorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import {
  canStudentViewCertificate,
  resolveCertificateUiStatus,
  type AchievementCertificateLike,
} from "@/lib/certificate-eligibility";

export type DashboardAchievementRow = {
  id: string;
  title: string;
  categoryLabel: string;
  levelLabel: string | null;
  scoreShort: string;
  date: string | null;
  featured: boolean;
  isFeatured: boolean;
  verificationStatus: string;
  approvalStatus: string;
  status: string;
  approved: boolean;
  pendingReReview: boolean;
  workflowStatus: WorkflowDisplayStatus;
  certificateAvailable: boolean;
  certificateStatus: ReturnType<typeof resolveCertificateUiStatus>;
  certificateLabel: string;
};

const toInput = (a: Record<string, unknown>) => ({
  titleAr: a.titleAr,
  nameAr: a.nameAr,
  nameEn: a.nameEn,
  title: a.title,
  achievementName: a.achievementName,
  customAchievementName: a.customAchievementName,
});

export const formatAchievementForDashboard = (
  a: Record<string, unknown>,
  loc: AchievementLabelLocale
): DashboardAchievementRow | null => {
  const id = String((a._id as { toString?: () => string } | undefined)?.toString?.() ?? a.id ?? "");
  if (!id || id === "undefined") return null;

  const pendingReReview = a.pendingReReview === true;
  const workflowStatus = resolveWorkflowDisplayStatus(a);

  const safeDate =
    a.date instanceof Date
      ? a.date
      : a.createdAt instanceof Date
        ? a.createdAt
        : typeof a.date === "string" && a.date
          ? new Date(a.date)
          : typeof a.createdAt === "string" && a.createdAt
            ? new Date(a.createdAt)
            : typeof a.achievementYear === "number"
              ? new Date(`${a.achievementYear}-01-01`)
              : null;

  const certLike = a as unknown as AchievementCertificateLike;
  const certificateStatus = resolveCertificateUiStatus(certLike);
  const certificateAvailable = canStudentViewCertificate(certLike);

  const level = String(a.achievementLevel || a.level || "").trim();

  return {
    id,
    title: getAchievementDisplayName(toInput(a) as Parameters<typeof getAchievementDisplayName>[0], loc),
    categoryLabel: getDashboardAchievementCategoryLine(a, loc),
    levelLabel: level ? getAchievementLevelLabel(level, loc) : null,
    scoreShort: getAchievementScoreDisplay(a, loc),
    date: safeDate && !Number.isNaN(safeDate.getTime()) ? safeDate.toISOString().split("T")[0] : null,
    featured: Boolean(a.featured),
    isFeatured: a.isFeatured === true || a.featured === true,
    verificationStatus: String(a.verificationStatus || "unverified"),
    approvalStatus: workflowStatus,
    status: String(a.status || ""),
    approved: a.approved === true,
    pendingReReview,
    workflowStatus,
    certificateAvailable,
    certificateStatus,
    certificateLabel: labelCertificateUiStatus(certificateStatus, loc),
  };
};
