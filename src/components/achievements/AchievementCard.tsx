import { useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Award, Pencil, ScrollText, Trash2 } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import {
  normalizeAchievementImage,
  normalizeAchievementNames,
  normalizeApprovalStatus,
} from "@/lib/achievementNormalize";
import { isStudentEditLocked, type AchievementWorkflowLike } from "@/lib/achievementWorkflow";
import { getAchievementScoreDisplay, safeTrim } from "@/lib/achievementDisplay";
import { resolveAchievementTitle } from "@/lib/achievement-title-resolver";
import {
  getAchievementLevelLabel,
  getAchievementResultLabel,
  getAchievementTypeLabel,
  getParticipationTypeLabel,
  getResultTypeLabel,
  getStudentAchievementCardFieldDisplay,
} from "@/lib/achievement-display-labels";
import AchievementStatusBadge from "@/components/achievements/AchievementStatusBadge";
import StudentAchievementDataRows from "@/components/achievements/StudentAchievementDataRows";
import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";

type AchievementCardProps = {
  id: string;
  title: string;
  titleAr?: string;
  nameAr?: string;
  nameEn?: string;
  achievementName?: string;
  customAchievementName?: string;
  /** Not shown on the card — details page only */
  description?: string;
  category: string;
  achievementType?: string;
  achievementLevel?: string;
  score?: number;
  resultType?: string;
  resultValue?: string;
  medalType?: string;
  rank?: string;
  inferredField?: string;
  participationType?: string;
  achievementYear?: number | null;
  date: string;
  image?: string;
  featured?: boolean;
  approved?: boolean;
  status?: string;
  isFeatured?: boolean;
  approvalStatus?: string;
  pendingReReview?: boolean;
  certificateAvailable?: boolean;
  certificateIssuedAt?: string | null;
  onDelete?: (id: string) => void;
  className?: string;
};

const AchievementCard = ({
  id,
  title,
  titleAr,
  nameAr,
  nameEn,
  achievementName,
  customAchievementName,
  description: _description,
  category: _category,
  achievementType,
  achievementLevel,
  score,
  resultType,
  resultValue,
  medalType,
  rank,
  inferredField,
  participationType,
  achievementYear,
  date: _date,
  image,
  featured = false,
  approved,
  status,
  isFeatured,
  approvalStatus,
  pendingReReview,
  certificateAvailable,
  certificateIssuedAt,
  onDelete,
  className = "",
}: AchievementCardProps) => {
  const locale = getLocale();
  const loc = locale === "ar" ? "ar" : "en";
  const [imageError, setImageError] = useState(false);

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(id);
  };

  const rawRec = {
    nameAr,
    nameEn,
    title,
    achievementName: achievementName || title,
    image,
    featured,
    approved,
    status,
    isFeatured,
    approvalStatus,
    pendingReReview,
  };

  const imgUrl =
    normalizeAchievementImage(rawRec as any) ||
    (image &&
    (image.startsWith("http") ||
      image.startsWith("data:image/") ||
      (image.startsWith("/") &&
        !image.includes("science.jpg") &&
        !image.includes("innovation.jpg")))
      ? image
      : null);
  const imgUnoptimized =
    typeof imgUrl === "string" &&
    (imgUrl.startsWith("data:") || imgUrl.startsWith("http://") || imgUrl.startsWith("https://"));

  const approvalNorm = normalizeApprovalStatus(rawRec as any);
  const isLocked = isStudentEditLocked(rawRec as AchievementWorkflowLike);
  normalizeAchievementNames(rawRec as any);

  const typeKey = String(achievementType || "").trim();
  const levelKey = String(achievementLevel || "").trim();

  const cardTitle = resolveAchievementTitle(
    {
      titleAr,
      nameAr,
      nameEn,
      title,
      achievementName,
      customAchievementName,
      achievementType,
    },
    loc
  );

  const typeLabel = typeKey ? getAchievementTypeLabel(typeKey, loc) : loc === "ar" ? "غير محدد" : "Not specified";
  const fieldLabel = getStudentAchievementCardFieldDisplay(inferredField, loc);
  const resultTypeLabel = getResultTypeLabel(resultType, loc);

  const resultLineRaw = getAchievementResultLabel(
    {
      resultType,
      medalType,
      rank,
      resultValue,
      score,
    } as Record<string, unknown>,
    loc
  );
  const resultLine =
    resultLineRaw && resultLineRaw !== "—"
      ? resultLineRaw
      : safeTrim(resultValue) || (loc === "ar" ? "غير محدد" : "Not specified");

  const levelLabel = levelKey
    ? getAchievementLevelLabel(levelKey, loc)
    : loc === "ar"
      ? "غير محدد"
      : "Not specified";

  const participationLabel = getParticipationTypeLabel(participationType, loc);
  const participationDisplay =
    loc === "en" && participationLabel === "—" ? "Not specified" : participationLabel;

  const yearLabel =
    achievementYear != null && Number.isFinite(achievementYear) && achievementYear > 0
      ? String(achievementYear)
      : loc === "ar"
        ? "غير محدد"
        : "Not specified";

  const scoreNumeric = getAchievementScoreDisplay({ score }, loc);
  const scoreLabel =
    scoreNumeric !== "—"
      ? loc === "ar"
        ? `${scoreNumeric} نقطة`
        : `${scoreNumeric} pts`
      : loc === "ar"
        ? "غير محدد"
        : "Not specified";

  const workflowBadgeStatus: WorkflowDisplayStatus =
    approvalNorm === "featured"
      ? "featured"
      : approvalNorm === "pending_re_review"
        ? "pending_re_review"
        : approvalNorm === "approved"
          ? "approved"
          : approvalNorm === "needs_revision"
            ? "needs_revision"
            : approvalNorm === "rejected"
              ? "rejected"
              : "pending";

  return (
    <div
      className={`group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:border-primary hover:shadow-md ${className}`}
    >
      <div className="relative h-44 w-full overflow-hidden bg-gray-100 sm:h-48">
        {imgUrl && !imageError ? (
          <Image
            src={imgUrl}
            alt={cardTitle}
            fill
            unoptimized={imgUnoptimized}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/12 to-primary/6">
            <Award className="h-12 w-12 text-primary/45" />
          </div>
        )}
        <div className="pointer-events-none absolute right-2 top-2 flex max-w-[58%] flex-col items-end gap-1">
          <AchievementStatusBadge status={workflowBadgeStatus} locale={loc} className="max-w-full truncate shadow-sm" />
          {certificateAvailable ? (
            <span className="rounded-full bg-emerald-600/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {locale === "ar" ? "شهادة صادرة" : "Issued"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <h3 className="mb-3 text-lg font-bold leading-snug text-text line-clamp-2 group-hover:text-primary">
          {cardTitle}
        </h3>

        <StudentAchievementDataRows
          locale={loc}
          levelKey={levelKey}
          medalType={String(medalType || "")}
          resultType={String(resultType || "")}
          content={{
            typeLabel,
            fieldLabel,
            resultTypeLabel,
            resultLine,
            levelLabel,
            participationLabel: participationDisplay,
            yearLabel,
            scoreLabel,
          }}
        />

        {certificateAvailable && certificateIssuedAt ? (
          <p className="mt-3 text-[10px] font-medium text-emerald-800">
            {locale === "ar" ? "أُصدرت الشهادة: " : "Certificate issued: "}
            {new Date(certificateIssuedAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/achievements/${id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              {locale === "ar" ? "عرض التفاصيل" : "View details"}
            </Link>
            {certificateAvailable ? (
              <Link
                href={`/achievements/${id}/certificate`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100"
              >
                <ScrollText className="h-3.5 w-3.5" aria-hidden />
                {locale === "ar" ? "الشهادة" : "Certificate"}
              </Link>
            ) : null}
          </div>
          {!isLocked && (
            <div className="flex items-center gap-2">
              <Link
                href={`/achievements/new?edit=${id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {locale === "ar" ? "تعديل" : "Edit"}
              </Link>
              <button
                type="button"
                onClick={handleDeleteClick}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                aria-label={locale === "ar" ? "حذف الإنجاز" : "Delete achievement"}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {locale === "ar" ? "حذف" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AchievementCard;
