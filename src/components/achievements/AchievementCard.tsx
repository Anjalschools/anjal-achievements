import { useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Award, Calendar, Pencil, Star, Trash2, ScrollText } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import {
  normalizeAchievementImage,
  normalizeAchievementNames,
  normalizeApprovalStatus,
} from "@/lib/achievementNormalize";
import { isStudentEditLocked, type AchievementWorkflowLike } from "@/lib/achievementWorkflow";
import {
  formatLocalizedResultLine,
  getAchievementDisplayName,
  getAchievementLevelLabel,
  getAchievementScoreDisplay,
  isLikelyTechnicalSlug,
  resolveAchievementEventSlug,
  safeTrim,
} from "@/lib/achievementDisplay";
import { getAchievementFieldLabel, getAchievementTypeLabel } from "@/lib/achievement-display-labels";
import AchievementStatusBadge from "@/components/achievements/AchievementStatusBadge";
import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";

type AchievementCardProps = {
  id: string;
  title: string;
  titleAr?: string;
  nameAr?: string;
  nameEn?: string;
  achievementName?: string;
  customAchievementName?: string;
  description: string;
  category: string;
  achievementType?: string;
  achievementLevel?: string;
  score?: number;
  resultType?: string;
  resultValue?: string;
  medalType?: string;
  rank?: string;
  inferredField?: string;
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
  description,
  category: _category,
  achievementType,
  achievementLevel,
  score,
  resultType,
  resultValue,
  medalType,
  rank,
  inferredField,
  date,
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
  const safeDate = date ? new Date(date) : null;
  const canFormatDate = Boolean(safeDate && !Number.isNaN(safeDate.getTime()));

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
  const names = normalizeAchievementNames(rawRec as any);
  const displayName = getAchievementDisplayName(
    {
      titleAr: titleAr || nameAr,
      nameAr,
      nameEn,
      title,
      achievementName: achievementName || title,
      customAchievementName,
    },
    loc
  );
  let secondaryName =
    loc === "ar"
      ? names.normalizedNameEn && names.normalizedNameEn !== displayName
        ? names.normalizedNameEn
        : ""
      : names.normalizedNameAr && names.normalizedNameAr !== displayName
        ? names.normalizedNameAr
        : "";
  if (secondaryName && isLikelyTechnicalSlug(secondaryName)) {
    const hit = resolveAchievementEventSlug(secondaryName);
    secondaryName = hit ? (loc === "ar" ? hit.en : hit.ar) : "";
  }
  if (secondaryName === displayName) secondaryName = "";

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
  const displayType = achievementType ? getAchievementTypeLabel(achievementType, loc) : "";
  const displayResult = formatLocalizedResultLine(resultType, medalType || resultValue, rank, loc);
  const descriptionSafe = safeTrim(description);
  const levelLabel = getAchievementLevelLabel(achievementLevel, loc);
  const scoreNumeric = getAchievementScoreDisplay({ score }, loc);
  const scoreLine =
    scoreNumeric !== "—"
      ? locale === "ar"
        ? `${scoreNumeric} نقطة`
        : `${scoreNumeric} pts`
      : "—";

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
      {/* Image */}
      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
        {imgUrl && !imageError ? (
          <Image
            src={imgUrl}
            alt={displayName}
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
        <div className="pointer-events-none absolute right-2 top-2 flex max-w-[55%] flex-col items-end gap-1">
          <AchievementStatusBadge status={workflowBadgeStatus} locale={loc} className="max-w-full truncate shadow-sm" />
          {certificateAvailable ? (
            <span className="rounded-full bg-emerald-600/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {locale === "ar" ? "شهادة صادرة" : "Issued"}
            </span>
          ) : null}
        </div>
      </div>

      {/* Content — order: title → type → date → field → level → score */}
      <div className="p-6">
        <h3 className="mb-1 text-lg font-bold text-text line-clamp-2 group-hover:text-primary">
          {displayName}
        </h3>
        {secondaryName ? (
          <p className="mb-2 text-xs text-text-muted line-clamp-1">{secondaryName}</p>
        ) : null}

        {displayType ? (
          <p className="mb-2 text-sm text-text">
            <span className="font-medium text-text-muted">
              {locale === "ar" ? "نوع الإنجاز: " : "Achievement type: "}
            </span>
            {displayType}
          </p>
        ) : null}

        <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>
            {canFormatDate
              ? safeDate?.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : locale === "ar"
                ? "تاريخ غير متوفر"
                : "Date unavailable"}
          </span>
        </div>

        {inferredField ? (
          <p className="mb-2 text-xs text-text-muted">
            <span className="font-medium text-text">{locale === "ar" ? "المجال: " : "Field: "}</span>
            {getAchievementFieldLabel(inferredField, loc)}
          </p>
        ) : null}

        <p className="mb-2 text-sm text-text">
          <span className="font-medium text-text-muted">{locale === "ar" ? "المستوى: " : "Level: "}</span>
          <span className="font-semibold text-text">{levelLabel}</span>
        </p>

        <div
          className={`mb-3 flex items-center gap-2 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-amber-50/70 px-3 py-2.5 ${
            scoreNumeric === "—" ? "opacity-80" : ""
          }`}
        >
          <Star className={`h-5 w-5 shrink-0 ${scoreNumeric === "—" ? "text-amber-400" : "fill-amber-400 text-amber-500"}`} />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80">
              {locale === "ar" ? "النقاط" : "Points"}
            </span>
            <p className="text-xl font-extrabold leading-tight text-amber-900">{scoreLine}</p>
          </div>
        </div>

        {descriptionSafe ? (
          <p className="mb-2 line-clamp-2 text-xs text-text-light">{descriptionSafe}</p>
        ) : null}
        {displayResult ? (
          <p className="mb-3 text-xs font-medium text-text-muted">{displayResult}</p>
        ) : null}

        {certificateAvailable && certificateIssuedAt ? (
          <p className="mb-2 text-[10px] font-medium text-emerald-800">
            {locale === "ar" ? "أُصدرت: " : "Issued: "}
            {new Date(certificateIssuedAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
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
