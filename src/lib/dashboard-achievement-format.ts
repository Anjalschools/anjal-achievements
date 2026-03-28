import { getAchievementLevelLabel, getAchievementScoreDisplay } from "@/lib/achievementDisplay";
import { resolveAchievementTitle } from "@/lib/achievement-title-resolver";
import {
  getAchievementResultLabel,
  getAchievementTypeLabel,
  getParticipationTypeLabel,
  getResultTypeLabel,
  getStudentAchievementCardFieldDisplay,
} from "@/lib/achievement-display-labels";
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

const safeTrim = (v: unknown) => String(v ?? "").trim();

export type DashboardAchievementSummary = {
  levelKey: string;
  medalType: string;
  resultType: string;
  typeLabel: string;
  fieldLabel: string;
  resultTypeLabel: string;
  resultLine: string;
  levelLabel: string;
  participationLabel: string;
  yearLabel: string;
  scoreLabel: string;
};

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
  summary: DashboardAchievementSummary;
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

  const levelKey = String(a.achievementLevel || a.level || "").trim();

  const displayLoc = loc === "ar" ? "ar" : "en";
  const achievementType = String(a.achievementType || "").trim();
  const title = resolveAchievementTitle(a, displayLoc) || (loc === "ar" ? "إنجاز" : "Achievement");

  const inferred = String(a.inferredField || a.domain || "").trim();
  const fieldLabel = getStudentAchievementCardFieldDisplay(inferred || undefined, displayLoc);

  const resultType = String(a.resultType || "");
  const resultTypeLabel = getResultTypeLabel(resultType || undefined, displayLoc);

  const resultLineRaw = getAchievementResultLabel(
    {
      resultType: a.resultType,
      medalType: a.medalType,
      rank: a.rank,
      resultValue: a.resultValue,
      score: a.score,
    } as Record<string, unknown>,
    displayLoc
  );
  const resultLine =
    resultLineRaw && resultLineRaw !== "—"
      ? resultLineRaw
      : safeTrim(a.resultValue) || (loc === "ar" ? "غير محدد" : "Not specified");

  const levelLabelFull = levelKey
    ? getAchievementLevelLabel(levelKey, displayLoc)
    : loc === "ar"
      ? "غير محدد"
      : "Not specified";

  const part = getParticipationTypeLabel(String(a.participationType || ""), displayLoc);
  const participationLabel = loc === "en" && part === "—" ? "Not specified" : part;

  const y = typeof a.achievementYear === "number" ? a.achievementYear : null;
  const yearLabel =
    y != null && y > 0 ? String(y) : loc === "ar" ? "غير محدد" : "Not specified";

  const scoreNum = getAchievementScoreDisplay(a, loc);
  const scoreLabel =
    scoreNum !== "—"
      ? loc === "ar"
        ? `${scoreNum} نقطة`
        : `${scoreNum} pts`
      : loc === "ar"
        ? "غير محدد"
        : "Not specified";

  const typeLabel = achievementType
    ? getAchievementTypeLabel(achievementType, displayLoc)
    : loc === "ar"
      ? "غير محدد"
      : "Not specified";

  const summary: DashboardAchievementSummary = {
    levelKey,
    medalType: String(a.medalType || ""),
    resultType,
    typeLabel,
    fieldLabel,
    resultTypeLabel,
    resultLine,
    levelLabel: levelLabelFull,
    participationLabel,
    yearLabel,
    scoreLabel,
  };

  return {
    id,
    title,
    categoryLabel: getDashboardAchievementCategoryLine(a, loc),
    levelLabel: levelKey ? getAchievementLevelLabel(levelKey, loc) : null,
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
    summary,
  };
};
