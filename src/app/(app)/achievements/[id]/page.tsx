"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Award,
  Calendar,
  ChevronRight,
  ExternalLink,
  FileText,
  Tag,
} from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import {
  normalizeAchievementImage,
  normalizeApprovalStatus,
  type ApprovalStatusNormalized,
} from "@/lib/achievementNormalize";
import { labelApprovalStatus, labelEvidenceMode, labelVerificationStatus } from "@/lib/achievementDisplay";
import {
  buildAttachmentRow,
  mergeStudentDetailAttachmentSources,
  partitionStudentAchievementDescription,
  studentFormatAchievementTitle,
  studentFormatAchievementType,
  studentFormatCategory,
  studentFormatCertificateStatus,
  studentFormatClassification,
  studentFormatDescription,
  studentFormatField,
  studentFormatLevel,
  studentFormatOrganizer,
  studentFormatResultLine,
  studentFormatResultTypeLabel,
  studentNotSpecified,
  resolveStudentAttachmentHref,
  studentDataUrlDownloadName,
} from "@/lib/student-achievement-details-display";
import { openResolvedAttachmentInNewTab } from "@/lib/achievement-attachment-open";

type ReviewComment = {
  message?: string;
  type?: string;
  createdAt?: string;
};

type AchievementDetails = {
  id: string;
  title: string;
  nameAr?: string;
  nameEn?: string;
  description: string;
  achievementCategory?: string;
  domain?: string;
  inferredField?: string;
  achievementType?: string;
  level?: string;
  achievementLevel?: string;
  resultType?: string;
  resultValue?: string;
  date?: string;
  image?: string | null;
  verificationStatus?: string;
  approvalStatus?: "pending" | "approved" | "featured" | "needs_revision" | "rejected";
  status?: string;
  featured?: boolean;
  approved?: boolean;
  medalType?: string;
  rank?: string;
  participationType?: string;
  achievementClassification?: string;
  attachments?: string[];
  attachmentItems?: Array<{ url: string; mimeType: string; name: string }>;
  resubmittedByStudent?: boolean;
  evidenceUrl?: string;
  evidenceFileName?: string;
  score?: number;
  achievementName?: string;
  requiresCommitteeReview?: boolean;
  evidenceRequiredMode?: string;
  reviewNote?: string;
  reviewComments?: ReviewComment[];
  aiReviewStatus?: string;
  aiFlags?: string[];
  aiSummary?: string;
  certificateIssued?: boolean;
  certificateVerificationUrl?: string | null;
  certificateAvailable?: boolean;
  certificateEligible?: boolean;
  certificateLegacy?: boolean;
  certificateStatus?: string;
  certificateIssuedAt?: string | null;
  certificateApprovedByRole?: string | null;
  certificateIssuerLabelAr?: string;
  certificateIssuerLabelEn?: string;
  principalApprovedAt?: string | null;
  activitySupervisorApprovedAt?: string | null;
  certificateRevokedAt?: string | null;
  editLocked?: boolean;
  organization?: string;
  programName?: string;
  customProgramName?: string;
  competitionName?: string;
  customCompetitionName?: string;
  exhibitionName?: string;
  customExhibitionName?: string;
  olympiadMeeting?: string;
  customAchievementName?: string;
};

const statusBadgeStyles = (norm: ApprovalStatusNormalized): string => {
  switch (norm) {
    case "approved":
    case "featured":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700/15";
    case "needs_revision":
      return "bg-red-50 text-red-900 ring-1 ring-red-700/15";
    case "rejected":
      return "bg-red-100 text-red-950 ring-1 ring-red-800/25";
    case "pending":
    case "pending_re_review":
      return "bg-amber-50 text-amber-950 ring-1 ring-amber-700/20";
    default:
      return "bg-neutral-100 text-neutral-800 ring-1 ring-neutral-400/25";
  }
};

const certificateBadgeStyles = (status: string | undefined): string => {
  const s = String(status || "");
  if (s === "issued") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700/15";
  if (s === "revoked") return "bg-red-50 text-red-900 ring-1 ring-red-700/15";
  return "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-400/25";
};

const summaryToneClass = (kind: "success" | "warning" | "danger" | "neutral"): string => {
  switch (kind) {
    case "success":
      return "border-emerald-200 bg-emerald-50/90";
    case "warning":
      return "border-amber-200 bg-amber-50/90";
    case "danger":
      return "border-red-200 bg-red-50/90";
    default:
      return "border-neutral-200 bg-neutral-50/90";
  }
};

type DetailStatProps = {
  label: string;
  value: string;
  icon?: ReactNode;
};

const DetailStat = ({ label, value, icon }: DetailStatProps) => (
  <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-neutral-100 bg-neutral-50/80 p-4">
    <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-text-muted">
      {icon ? <span className="shrink-0 text-text-muted">{icon}</span> : null}
      <span className="min-w-0 leading-snug">{label}</span>
    </div>
    <p className="break-words text-sm font-semibold leading-snug text-text">{value}</p>
  </div>
);

type SummaryTileProps = {
  title: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

const SummaryTile = ({ title, value, tone }: SummaryTileProps) => (
  <div className={`rounded-xl border p-4 ${summaryToneClass(tone)}`}>
    <p className="text-xs font-medium text-text-muted">{title}</p>
    <p className="mt-1 text-sm font-semibold text-text">{value}</p>
  </div>
);

const AchievementDetailsPage = () => {
  const params = useParams<{ id: string }>();
  const locale = getLocale();
  const [isLoading, setIsLoading] = useState(true);
  const [achievement, setAchievement] = useState<AchievementDetails | null>(null);
  const [error, setError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [resubmitBusy, setResubmitBusy] = useState(false);
  const [clientOrigin, setClientOrigin] = useState("");
  const [openAttachmentError, setOpenAttachmentError] = useState<string | null>(null);

  const handleResubmit = useCallback(async () => {
    if (!params?.id) return;
    setResubmitBusy(true);
    try {
      const res = await fetch(`/api/achievements/${params.id}/resubmit`, { method: "PATCH" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Failed");
      }
      const response = await fetch(`/api/achievements/${params.id}`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setAchievement(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResubmitBusy(false);
    }
  }, [params?.id]);

  useEffect(() => {
    setClientOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const handleOpenAttachment = useCallback(
    (href: string | null | undefined) => {
      if (!href) return;
      setOpenAttachmentError(null);
      const ok = openResolvedAttachmentInNewTab(href);
      if (!ok) {
        setOpenAttachmentError(
          locale === "ar"
            ? "تعذر فتح الملف. جرّب زر «تحميل»."
            : "Could not open the file. Try “Download”."
        );
      }
    },
    [locale]
  );

  useEffect(() => {
    const fetchDetails = async () => {
      if (!params?.id) return;
      try {
        setIsLoading(true);
        const response = await fetch(`/api/achievements/${params.id}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to fetch achievement");
        }
        const data = await response.json();
        setAchievement(data);
        setImageFailed(false);
      } catch (err) {
        setError(locale === "ar" ? "تعذر تحميل تفاصيل الإنجاز" : "Failed to load achievement details");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [params?.id, locale]);

  const loc = locale === "ar" ? "ar" : "en";

  const attachmentRows = useMemo(() => {
    if (!achievement) return [];
    const originArg = clientOrigin || undefined;
    const structured =
      Array.isArray(achievement.attachmentItems) && achievement.attachmentItems.length > 0
        ? achievement.attachmentItems
        : null;
    if (structured) {
      return structured
        .map((a, i) => buildAttachmentRow(a, i, loc, originArg))
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    }
    const { derivedFileStrings } = partitionStudentAchievementDescription(achievement.description);
    const ev = String(achievement.evidenceUrl || "").trim();
    const merged = mergeStudentDetailAttachmentSources(
      derivedFileStrings,
      achievement.attachments,
      ev || undefined
    );
    return merged
      .map((a, i) => buildAttachmentRow(a, i, loc, originArg))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [achievement, loc, clientOrigin]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="py-12 text-center text-text-light">{locale === "ar" ? "جاري التحميل..." : "Loading..."}</div>
      </PageContainer>
    );
  }

  if (error || !achievement) {
    return (
      <PageContainer>
        <SectionCard>
          <p className="text-sm text-red-600">
            {error || (locale === "ar" ? "الإنجاز غير موجود" : "Achievement not found")}
          </p>
          <Link href="/achievements" className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
            {locale === "ar" ? "العودة للإنجازات" : "Back to achievements"}
          </Link>
        </SectionCard>
      </PageContainer>
    );
  }

  const safeDate = achievement.date ? new Date(achievement.date) : null;
  const dateText =
    safeDate && !Number.isNaN(safeDate.getTime())
      ? safeDate.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : locale === "ar"
        ? "تاريخ غير متوفر"
        : "Date unavailable";

  const rawAchievement = achievement as Record<string, unknown>;
  const mainTitle = studentFormatAchievementTitle(rawAchievement, loc);
  const altLoc = loc === "ar" ? "en" : "ar";
  const alternateTitle = studentFormatAchievementTitle(rawAchievement, altLoc);
  const secondaryTitle = alternateTitle && alternateTitle !== mainTitle ? alternateTitle : "";

  const imgSrc = normalizeAchievementImage(achievement as Record<string, unknown>) || achievement.image || null;
  const imgUnoptimized =
    typeof imgSrc === "string" &&
    (imgSrc.startsWith("data:") || imgSrc.startsWith("http://") || imgSrc.startsWith("https://"));

  const approvalNorm = normalizeApprovalStatus(achievement as Record<string, unknown>);
  const statusText =
    achievement.resubmittedByStudent === true && approvalNorm === "pending"
      ? loc === "ar"
        ? "بانتظار الاعتماد"
        : "Pending approval"
      : labelApprovalStatus(approvalNorm, loc);
  const needsRevision = approvalNorm === "needs_revision";
  const isRejected = approvalNorm === "rejected";

  const lastReviewerMessage = (() => {
    const comments = achievement.reviewComments;
    if (!Array.isArray(comments)) return achievement.reviewNote || "";
    const rev = [...comments].reverse().find(
      (c) => c?.type === "revision_request" || c?.type === "admin_rejection"
    );
    return rev?.message || achievement.reviewNote || "";
  })();

  const showStudentFollowUp = needsRevision || isRejected;

  const typeLabel = studentFormatAchievementType(achievement.achievementType, loc);
  const catLabel = studentFormatCategory(achievement.achievementCategory, loc);
  const classLabel = studentFormatClassification(achievement.achievementClassification, loc);
  const levelLabel = studentFormatLevel(achievement.achievementLevel || achievement.level, loc);
  const fieldLabel = studentFormatField(achievement.inferredField || achievement.domain, loc);
  const resultLine = studentFormatResultLine(
    {
      resultType: achievement.resultType,
      medalType: achievement.medalType,
      rank: achievement.rank,
      resultValue: achievement.resultValue,
    },
    loc
  );
  const resultTypeLabel = studentFormatResultTypeLabel(achievement.resultType, loc);

  const organizerLabel = studentFormatOrganizer(achievement as Record<string, unknown>, loc);

  const descriptionBody = studentFormatDescription(achievement.description, loc);

  const evidenceUrlTrimmed = String(achievement.evidenceUrl || "").trim();
  const evidenceHrefResolved = resolveStudentAttachmentHref(
    evidenceUrlTrimmed,
    clientOrigin || undefined
  );
  const hasEvidenceUrl = Boolean(evidenceUrlTrimmed);
  const evidenceLinkWorks = Boolean(evidenceHrefResolved);
  const evidenceFileTrimmed = String(achievement.evidenceFileName || "").trim();

  const certStatusLabel = studentFormatCertificateStatus(achievement.certificateStatus, loc);

  const dataStatusLabel = labelEvidenceMode(
    achievement.evidenceRequiredMode === "skipped" ? "skipped" : "provided",
    loc
  );
  const verificationLabel = labelVerificationStatus(achievement.verificationStatus, loc);

  const scoreDisplay =
    typeof achievement.score === "number" && Number.isFinite(achievement.score)
      ? String(Math.round(achievement.score))
      : studentNotSpecified(loc);

  const summaryTiles: SummaryTileProps[] = [
    {
      title: locale === "ar" ? "حالة البيانات" : "Data status",
      value: dataStatusLabel,
      tone: achievement.evidenceRequiredMode === "skipped" ? "neutral" : "success",
    },
    {
      title: locale === "ar" ? "حالة التحقق" : "Verification status",
      value: verificationLabel,
      tone:
        achievement.verificationStatus === "verified"
          ? "success"
          : achievement.verificationStatus === "mismatch"
            ? "danger"
            : achievement.verificationStatus === "pending_committee_review"
              ? "warning"
              : "neutral",
    },
    {
      title: locale === "ar" ? "النقاط" : "Points",
      value: scoreDisplay,
      tone: "neutral",
    },
    {
      title: locale === "ar" ? "حالة الشهادة" : "Certificate status",
      value: certStatusLabel,
      tone:
        achievement.certificateStatus === "issued"
          ? "success"
          : achievement.certificateStatus === "revoked"
            ? "danger"
            : "neutral",
    },
  ];

  return (
    <PageContainer className="pb-12">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <nav aria-label={locale === "ar" ? "مسار التنقل" : "Breadcrumb"}>
          <Link
            href="/achievements"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            {locale === "ar" ? "الإنجازات" : "Achievements"}
            <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden />
            <span className="font-medium text-text">{locale === "ar" ? "التفاصيل" : "Details"}</span>
          </Link>
        </nav>

        <SectionCard padding="lg" className="border-neutral-200/80 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <h1 className="text-2xl font-bold tracking-tight text-text md:text-3xl">
                {locale === "ar" ? "تفاصيل الإنجاز" : "Achievement details"}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeStyles(approvalNorm)}`}
                >
                  {statusText}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${certificateBadgeStyles(achievement.certificateStatus)}`}
                >
                  {certStatusLabel}
                </span>
              </div>
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                <span>{dateText}</span>
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              <Link
                href="/achievements"
                className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-text shadow-sm hover:bg-neutral-50"
              >
                {locale === "ar" ? "رجوع" : "Back"}
              </Link>
              {achievement.certificateAvailable ? (
                <>
                  <Link
                    href={`/achievements/${achievement.id}/certificate`}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                  >
                    {locale === "ar" ? "عرض الشهادة" : "View certificate"}
                  </Link>
                  {achievement.certificateVerificationUrl ? (
                    <Link
                      href={achievement.certificateVerificationUrl}
                      className="inline-flex items-center justify-center rounded-lg border border-emerald-700 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-50"
                    >
                      {locale === "ar" ? "التحقق الرسمي" : "Official verify"}
                    </Link>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </SectionCard>

        {showStudentFollowUp && lastReviewerMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              isRejected
                ? "border-red-200 bg-red-50 text-red-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
            role="status"
          >
            <p className="font-bold">
              {isRejected
                ? locale === "ar"
                  ? "سبب الرفض"
                  : "Rejection reason"
                : locale === "ar"
                  ? "ملاحظة من المراجع"
                  : "Reviewer note"}
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{lastReviewerMessage}</p>
          </div>
        ) : null}

        {needsRevision &&
        achievement.aiReviewStatus === "flagged" &&
        typeof achievement.aiSummary === "string" &&
        achievement.aiSummary.trim() ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">
              {locale === "ar" ? "مراجعة آلية (اقتراح فقط)" : "Automated pre-check (suggestion only)"}
            </p>
            <p className="mt-1 text-slate-700">{achievement.aiSummary}</p>
          </div>
        ) : null}

        {achievement.certificateAvailable ? null : approvalNorm === "approved" || approvalNorm === "featured" ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">
              {locale === "ar" ? "الشهادة بعد أول اعتماد" : "Certificate after first approval"}
            </p>
            <p className="mt-1 text-slate-600">
              {locale === "ar"
                ? "تُصدر شهادة الشكر تلقائيًا بمجرد اعتماد الإنجاز من إحدى الجهات المخوّلة: الإدارة، مدير المدرسة، رائد/مشرف النشاط، أو المحكم. يكفي اعتماد واحد فقط."
                : "Your appreciation certificate is issued automatically as soon as one authorized party approves: administration, school principal, activity supervisor, or judge. Only one approval is required."}
            </p>
          </div>
        ) : null}

        {showStudentFollowUp ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/achievements/new?edit=${achievement.id}`}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              {locale === "ar" ? "تعديل الإنجاز" : "Edit achievement"}
            </Link>
            <button
              type="button"
              disabled={resubmitBusy}
              onClick={handleResubmit}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50 disabled:opacity-50"
            >
              {resubmitBusy
                ? locale === "ar"
                  ? "جاري الإرسال..."
                  : "Submitting..."
                : locale === "ar"
                  ? "إعادة الإرسال للمراجعة"
                  : "Resubmit for review"}
            </button>
          </div>
        ) : null}

        <SectionCard padding="lg" className="overflow-hidden border-neutral-200/80">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-start xl:grid-cols-[minmax(0,340px)_1fr]">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 lg:mx-0 lg:max-w-none">
              {imgSrc && !imageFailed ? (
                <Image
                  src={imgSrc}
                  alt=""
                  fill
                  unoptimized={Boolean(imgUnoptimized)}
                  className="object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-neutral-50 to-neutral-100 p-6 text-center">
                  <div className="rounded-full bg-white p-4 shadow-sm ring-1 ring-neutral-200/80">
                    <Award className="h-10 w-10 text-primary/50" aria-hidden />
                  </div>
                  <p className="text-sm font-medium text-text-muted">
                    {locale === "ar" ? "لا توجد معاينة متاحة" : "No preview available"}
                  </p>
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-6">
              <div>
                <h2 className="text-xl font-bold leading-tight text-text md:text-2xl">{mainTitle}</h2>
                {secondaryTitle ? (
                  <p className="mt-1 text-sm text-text-muted">{secondaryTitle}</p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <DetailStat
                  label={locale === "ar" ? "نوع الفعالية" : "Activity type"}
                  value={typeLabel}
                />
                <DetailStat
                  label={locale === "ar" ? "تصنيف الإنجاز" : "Achievement category"}
                  value={catLabel}
                />
                <DetailStat
                  label={locale === "ar" ? "تصنيف المجال" : "Domain category"}
                  value={classLabel}
                />
                <DetailStat
                  label={locale === "ar" ? "المجال" : "Field / domain"}
                  value={fieldLabel}
                  icon={<Tag className="h-3.5 w-3.5" />}
                />
                <DetailStat
                  label={locale === "ar" ? "نوع النتيجة" : "Result type"}
                  value={resultTypeLabel}
                />
                <DetailStat label={locale === "ar" ? "النتيجة" : "Result"} value={resultLine} />
                <DetailStat
                  label={locale === "ar" ? "المستوى" : "Level"}
                  value={levelLabel}
                />
                <DetailStat
                  label={locale === "ar" ? "التاريخ" : "Date"}
                  value={dateText}
                  icon={<Calendar className="h-3.5 w-3.5" />}
                />
                {organizerLabel ? (
                  <DetailStat
                    label={locale === "ar" ? "الجهة المنظمة" : "Organizer"}
                    value={organizerLabel}
                  />
                ) : null}
                <DetailStat
                  label={locale === "ar" ? "حالة الإنجاز" : "Achievement status"}
                  value={statusText}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard padding="lg" className="border-neutral-200/80">
          <h2 className="mb-4 text-lg font-bold text-text md:text-xl">
            {locale === "ar" ? "الوصف والمرفقات" : "Description & attachments"}
          </h2>

          {openAttachmentError ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {openAttachmentError}
            </p>
          ) : null}

          <div className="mb-6 rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 md:p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {locale === "ar" ? "الوصف" : "Description"}
            </h3>
            {descriptionBody ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">{descriptionBody}</p>
            ) : (
              <p className="text-sm text-text-muted">
                {locale === "ar" ? "لا يوجد وصف مضاف." : "No description provided."}
              </p>
            )}
          </div>

          {(hasEvidenceUrl || evidenceFileTrimmed) && (
            <div className="mb-6 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {locale === "ar" ? "إثبات إضافي" : "Additional evidence"}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {hasEvidenceUrl && evidenceLinkWorks && evidenceHrefResolved ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment(evidenceHrefResolved)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                      {locale === "ar" ? "فتح" : "Open"}
                    </button>
                    <a
                      href={evidenceHrefResolved}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={
                        evidenceHrefResolved.startsWith("data:")
                          ? studentDataUrlDownloadName(evidenceHrefResolved)
                          : undefined
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                    >
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                      {locale === "ar" ? "تحميل" : "Download"}
                    </a>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">
                    {locale === "ar" ? "رابط غير متاح" : "Link unavailable"}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {locale === "ar" ? "المرفقات" : "Attachments"}
            </h3>
            {attachmentRows.length > 0 ? (
              <ul className="space-y-2">
                {attachmentRows.map((row, idx) => (
                  <li key={`attachment-${idx}`}>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4">
                      {row.displayName ? (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                          {row.displayName}
                        </span>
                      ) : null}
                      {row.canOpen && row.href ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(row.href)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                          >
                            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                            {locale === "ar" ? "فتح" : "Open"}
                          </button>
                          <a
                            href={row.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={row.dataDownloadName}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                          >
                            <FileText className="h-4 w-4 shrink-0" aria-hidden />
                            {locale === "ar" ? "تحميل" : "Download"}
                          </a>
                        </>
                      ) : (
                        <p className="text-sm text-text-muted">
                          {locale === "ar" ? "رابط غير متاح" : "Link unavailable"}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-8 text-center">
                <FileText className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
                <p className="mt-2 text-sm font-medium text-text-muted">
                  {locale === "ar" ? "لا توجد مرفقات" : "No attachments"}
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard padding="lg" className="border-neutral-200/80">
          <h2 className="mb-4 text-lg font-bold text-text md:text-xl">
            {locale === "ar" ? "ملخص الفحص والتحقق" : "Review & verification summary"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryTiles.map((t) => (
              <SummaryTile key={t.title} title={t.title} value={t.value} tone={t.tone} />
            ))}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
};

export default AchievementDetailsPage;
