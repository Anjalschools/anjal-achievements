"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import PartnershipContactAccessPanel from "@/components/partnerships/PartnershipContactAccessPanel";
import SupervisorParentConsentPanel from "@/components/partnerships/SupervisorParentConsentPanel";
import { GRADE_OPTIONS } from "@/constants/grades";
import { getLocale } from "@/lib/i18n";
import {
  trainingApplicationStatusBadgeClass,
  trainingApplicationStatusLabel,
} from "@/lib/partnerships/partnerships-application-status-ui";
import { timelineActionLabel } from "@/lib/partnerships/partnerships-application-workflow";
import { canTransitionApplicationStatus, canReopenRejectedTrainingApplication } from "@/lib/partnerships/partnerships-state-machine";
import {
  canSupervisorApproveApplication,
  resolveSupervisorTransitionSteps,
  supervisorApprovalBlockedReason,
} from "@/lib/partnerships/partnerships-application-workflow";
import {
  ArrowLeft,
  Award,
  ExternalLink,
  Loader2,
  ScrollText,
  Trophy,
  UserRound,
} from "lucide-react";

type AchievementSummaryItem = {
  title: string;
  outcome: string;
  year: string;
};

type ApplicationDetail = {
  id: string;
  status: string;
  academicYear: string;
  submittedAt: string | null;
  opportunityTitle: string;
  organizationName: string;
  reviewNotes: string;
  rejectionReason: string;
  studentSnapshot: {
    fullName: string;
    grade: string;
    stage: string;
    gender: string;
    school?: string;
    schoolType?: string;
  };
  excellenceScore: number | null;
  achievementSummary?: {
    items: AchievementSummaryItem[];
    totalAchievements: number;
    medalCount: number;
    participationCount: number;
    excellenceScore: number;
  };
  publicPortfolio?: {
    enabled: boolean;
    url: string | null;
  };
  timeline?: Array<{
    at: string | null;
    action: string;
    actorName?: string | null;
    note?: string | null;
  }>;
};

const stageLabel = (stage: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    elementary: { ar: "ابتدائي", en: "Elementary" },
    middle: { ar: "متوسط", en: "Middle" },
    high: { ar: "ثانوي", en: "High" },
  };
  return map[stage]?.[isAr ? "ar" : "en"] || stage;
};

const schoolLabel = (snapshot: ApplicationDetail["studentSnapshot"], isAr: boolean) => {
  if (snapshot.school) return snapshot.school;
  if (snapshot.schoolType === "arabic") return isAr ? "مسار عربي" : "Arabic track";
  if (snapshot.schoolType === "international") return isAr ? "مسار دولي" : "International track";
  return isAr ? "—" : "—";
};

const PartnershipApplicationDetailPage = () => {
  const params = useParams();
  const id = String(params?.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<ApplicationDetail | null>(null);
  const [timeline, setTimeline] = useState<ApplicationDetail["timeline"]>([]);
  const [note, setNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, timelineRes] = await Promise.all([
        fetch(`/api/admin/partnerships/applications/${encodeURIComponent(id)}`, { cache: "no-store" }),
        fetch(`/api/admin/partnerships/applications/${encodeURIComponent(id)}/timeline?locale=${isAr ? "ar" : "en"}`, {
          cache: "no-store",
        }),
      ]);
      const detailJson = await detailRes.json().catch(() => ({}));
      const timelineJson = await timelineRes.json().catch(() => ({}));
      if (!detailRes.ok) throw new Error(typeof detailJson.error === "string" ? detailJson.error : "Failed");
      setItem(detailJson.item || null);
      setTimeline(Array.isArray(timelineJson.items) ? timelineJson.items : detailJson.item?.timeline || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (
    action: "under_review" | "interview_requested" | "institution_review" | "accepted" | "rejected"
  ) => {
    if (!id || !item) return;
    if (action === "accepted" && !canSupervisorApproveApplication(item.status)) {
      setError(supervisorApprovalBlockedReason(item.status, isAr) || (isAr ? "لا يمكن الاعتماد." : "Cannot approve."));
      return;
    }
    if (action === "rejected" && !rejectionReason.trim()) {
      setError(isAr ? "سبب الرفض مطلوب." : "Rejection reason is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partnerships/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: note.trim() || undefined,
          rejectionReason: action === "rejected" ? rejectionReason.trim() : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setNote("");
      if (action === "rejected") setRejectionReason("");
      setItem(json.item || null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!id || !item) return;
    setReopening(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partnerships/applications/${encodeURIComponent(id)}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setReopenOpen(false);
      setReopenReason("");
      setItem(json.item || null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setReopening(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return isAr ? "—" : "—";
    try {
      return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
    } catch {
      return value;
    }
  };

  const gradeLabel =
    item &&
    (GRADE_OPTIONS.find((g) => g.value === item.studentSnapshot.grade)?.[isAr ? "ar" : "en"] ||
      item.studentSnapshot.grade);

  const actionButtons: Array<{
    action: "under_review" | "interview_requested" | "institution_review" | "accepted" | "rejected";
    label: string;
    tone: string;
  }> = [
    {
      action: "under_review",
      label: isAr ? "تحويل للمراجعة" : "Move to review",
      tone: "border-amber-300 bg-amber-50 text-amber-950",
    },
    {
      action: "interview_requested",
      label: isAr ? "طلب مقابلة" : "Request interview",
      tone: "border-violet-300 bg-violet-50 text-violet-950",
    },
    {
      action: "institution_review",
      label: isAr ? "إرسال للمؤسسة" : "Send to institution",
      tone: "border-indigo-300 bg-indigo-50 text-indigo-950",
    },
    {
      action: "accepted",
      label: isAr ? "اعتماد" : "Accept",
      tone: "border-emerald-300 bg-emerald-50 text-emerald-950",
    },
    {
      action: "rejected",
      label: isAr ? "رفض" : "Reject",
      tone: "border-red-300 bg-red-50 text-red-950",
    },
  ];

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/admin/partnerships/applications"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isAr ? "العودة إلى الطلبات" : "Back to applications"}
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : error && !item ? (
        <SectionCard>
          <p className="py-8 text-center text-red-600">{error}</p>
        </SectionCard>
      ) : item ? (
        <>
          <PageHeader
            title={item.studentSnapshot.fullName}
            subtitle={`${item.opportunityTitle} · ${item.organizationName}`}
          />

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ${trainingApplicationStatusBadgeClass(item.status)}`}
            >
              {trainingApplicationStatusLabel(item.status, isAr)}
            </span>
            <span className="text-sm text-text-light">
              {isAr ? "العام الدراسي:" : "Academic year:"} {item.academicYear}
            </span>
            <span className="text-sm text-text-light">
              {isAr ? "تاريخ التقديم:" : "Submitted:"} {formatDate(item.submittedAt)}
            </span>
          </div>

          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                <UserRound className="h-4 w-4 text-primary" aria-hidden />
                {isAr ? "بطاقة الطالب" : "Student card"}
              </h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-semibold text-foreground">{isAr ? "الاسم" : "Name"}</dt>
                  <dd className="text-text-light">{item.studentSnapshot.fullName}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">{isAr ? "الصف" : "Grade"}</dt>
                  <dd className="text-text-light">{gradeLabel}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">{isAr ? "المرحلة" : "Stage"}</dt>
                  <dd className="text-text-light">{stageLabel(item.studentSnapshot.stage, isAr)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">{isAr ? "الجنس" : "Gender"}</dt>
                  <dd className="text-text-light">
                    {item.studentSnapshot.gender === "male"
                      ? isAr
                        ? "بنين"
                        : "Male"
                      : item.studentSnapshot.gender === "female"
                        ? isAr
                          ? "بنات"
                          : "Female"
                        : item.studentSnapshot.gender}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">{isAr ? "المدرسة" : "School"}</dt>
                  <dd className="text-text-light">{schoolLabel(item.studentSnapshot, isAr)}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard className="xl:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Trophy className="h-4 w-4 text-primary" aria-hidden />
                  {isAr ? "ملخص الإنجازات" : "Achievement summary"}
                </h2>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2 text-center">
                  <p className="text-xs font-semibold text-primary">
                    {isAr ? "مؤشر التميز" : "Excellence score"}
                  </p>
                  <p className="text-2xl font-black text-primary">
                    {item.excellenceScore ?? item.achievementSummary?.excellenceScore ?? 0}
                    <span className="text-sm font-bold">/100</span>
                  </p>
                </div>
              </div>

              {!item.achievementSummary?.items?.length ? (
                <p className="text-sm text-text-light">
                  {isAr ? "لا توجد إنجازات معتمدة." : "No approved achievements found."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {item.achievementSummary.items.map((row, index) => (
                    <li
                      key={`${row.title}-${index}`}
                      className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
                    >
                      <p className="font-bold text-foreground">{row.title}</p>
                      <p className="text-sm text-text-light">
                        {row.outcome}
                        {row.year ? ` · ${row.year}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-3 text-xs text-text-light">
                <span>
                  {isAr ? "الإنجازات:" : "Achievements:"} {item.achievementSummary?.totalAchievements ?? 0}
                </span>
                <span>
                  {isAr ? "الميداليات:" : "Medals:"} {item.achievementSummary?.medalCount ?? 0}
                </span>
                <span>
                  {isAr ? "المشاركات:" : "Participations:"} {item.achievementSummary?.participationCount ?? 0}
                </span>
              </div>

              {item.publicPortfolio?.enabled && item.publicPortfolio.url ? (
                <a
                  href={item.publicPortfolio.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {isAr ? "عرض ملف الإنجاز العام" : "View public achievement portfolio"}
                </a>
              ) : (
                <p className="mt-4 text-sm text-text-light">
                  {isAr ? "ملف الإنجاز العام غير مفعّل." : "Public portfolio is not enabled."}
                </p>
              )}
            </SectionCard>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                <Award className="h-4 w-4 text-primary" aria-hidden />
                {isAr ? "إجراءات المشرف" : "Supervisor actions"}
              </h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isAr ? "ملاحظة المشرف (اختياري)" : "Supervisor note (optional)"}
                className="mb-3 min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "ملاحظة المشرف" : "Supervisor note"}
              />
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={isAr ? "سبب الرفض (مطلوب عند الرفض)" : "Rejection reason (required when rejecting)"}
                className="mb-3 min-h-20 w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "سبب الرفض" : "Rejection reason"}
              />
              <div className="flex flex-wrap gap-2">
                {actionButtons.map((button) => {
                  const canRun =
                    button.action === "institution_review" && item.status === "submitted"
                      ? true
                      : canTransitionApplicationStatus(item.status, button.action);
                  const approvalBlocked =
                    button.action === "accepted" && !canSupervisorApproveApplication(item.status);
                  return (
                  <button
                    key={button.action}
                    type="button"
                    disabled={saving || !canRun}
                    title={
                      approvalBlocked
                        ? supervisorApprovalBlockedReason(item.status, isAr) || undefined
                        : !canRun
                          ? isAr
                            ? "غير متاح في هذه الحالة"
                            : "Not available in this status"
                          : undefined
                    }
                    onClick={() => handleAction(button.action)}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${button.tone}`}
                  >
                    {saving ? "…" : button.label}
                  </button>
                  );
                })}
              </div>
              {!canSupervisorApproveApplication(item.status) ? (
                <p className="mt-3 text-xs text-amber-800">
                  {supervisorApprovalBlockedReason(item.status, isAr)}
                </p>
              ) : null}
              {item.reviewNotes ? (
                <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                  <p className="mb-1 font-semibold text-foreground">{isAr ? "ملاحظات المراجعة" : "Review notes"}</p>
                  <p className="whitespace-pre-wrap text-text-light">{item.reviewNotes}</p>
                </div>
              ) : null}
              {item.rejectionReason ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p className="mb-1 font-semibold">{isAr ? "سبب الرفض" : "Rejection reason"}</p>
                  <p>{item.rejectionReason}</p>
                </div>
              ) : null}
              {canReopenRejectedTrainingApplication(item.status) ? (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <button
                    type="button"
                    onClick={() => setReopenOpen(true)}
                    disabled={reopening}
                    className="inline-flex rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-950 transition hover:bg-sky-100 disabled:opacity-60"
                    aria-label={isAr ? "إعادة فتح الطلب" : "Reopen application"}
                  >
                    {isAr ? "إعادة فتح الطلب" : "Reopen application"}
                  </button>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                <ScrollText className="h-4 w-4 text-primary" aria-hidden />
                {isAr ? "سجل الإجراءات" : "Action timeline"}
              </h2>
              {!timeline?.length ? (
                <p className="text-sm text-text-light">{isAr ? "لا يوجد سجل بعد." : "No timeline yet."}</p>
              ) : (
                <ol className="space-y-3">
                  {timeline.map((event, index) => (
                    <li key={`${event.action}-${index}`} className="rounded-xl border border-border/60 px-4 py-3">
                      <p className="font-semibold text-foreground">
                        {"label" in event && typeof event.label === "string"
                          ? event.label
                          : timelineActionLabel(event.action, isAr)}
                      </p>
                      <p className="text-xs text-text-light">{formatDate(event.at)}</p>
                      {event.actorName ? (
                        <p className="text-xs text-text-light">
                          {isAr ? "بواسطة:" : "By:"} {event.actorName}
                        </p>
                      ) : null}
                      {event.note ? <p className="mt-1 text-sm text-text-light">{event.note}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>
          </div>

          <div className="mt-4 space-y-4">
            <SupervisorParentConsentPanel applicationId={id} isAr={isAr} />
            <PartnershipContactAccessPanel applicationId={id} isAr={isAr} />
          </div>

          {reopenOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label={isAr ? "إعادة فتح الطلب" : "Reopen application"}
            >
              <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="mb-2 text-lg font-bold text-foreground">
                  {isAr ? "هل تريد إعادة فتح الطلب؟" : "Reopen this application?"}
                </h3>
                <p className="mb-4 text-sm text-text-light">
                  {isAr
                    ? "سيتم إعادة الطلب إلى مرحلة المراجعة. يبقى سجل الرفض السابق في السجل والتدقيق."
                    : "The application will return to under review. Previous rejection history is preserved."}
                </p>
                <label className="mb-4 block text-sm">
                  <span className="mb-1 block font-semibold text-foreground">
                    {isAr ? "سبب إعادة الفتح (اختياري)" : "Reopen reason (optional)"}
                  </span>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    aria-label={isAr ? "سبب إعادة الفتح" : "Reopen reason"}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReopenOpen(false);
                      setReopenReason("");
                    }}
                    disabled={reopening}
                    className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReopen()}
                    disabled={reopening}
                    className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {reopening ? (isAr ? "جاري التنفيذ…" : "Processing…") : isAr ? "تأكيد" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
};

export default PartnershipApplicationDetailPage;
