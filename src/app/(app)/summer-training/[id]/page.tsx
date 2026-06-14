"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { getGradeLabel } from "@/constants/grades";
import TrainingApplicationTimeline from "@/components/partnerships/TrainingApplicationTimeline";
import TrainingApplicationStatusBadge from "@/components/partnerships/TrainingApplicationStatusBadge";
import TrainingApplicationStatusCard from "@/components/partnerships/TrainingApplicationStatusCard";
import TrainingAcceptedBanner from "@/components/partnerships/TrainingAcceptedBanner";
import TrainingCertificateActions, {
  type TrainingCertificateSummary,
} from "@/components/partnerships/TrainingCertificateActions";
import StudentInstitutionContactCard from "@/components/partnerships/StudentInstitutionContactCard";
import type { StudentInstitutionContactView } from "@/components/partnerships/StudentInstitutionContactCard";
import type { StudentTrainingApplicationSummary } from "@/lib/partnerships/partnerships-student-dashboard-context";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  Pencil,
  Send,
  Users,
  XCircle,
} from "lucide-react";

type ApplicationContext = {
  id: string;
  status: string;
  studentNotes: string;
  applicationMessage: string;
  submittedAt: string | null;
  lastUpdatedAt: string | null;
  canEdit: boolean;
  canWithdraw: boolean;
  timeline: Array<{ at: string | null; action: string; note: string }>;
};

type CommunicationContext = {
  applicationStatus: string | null;
  applicationStatusLabel: string | null;
  applicationId: string | null;
  reviewStatusLabel: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  threadId: string | null;
  timeline: Array<{ at: string | null; label: string; note: string }>;
};

type OpportunityDetail = {
  id: string;
  title: string;
  description: string;
  seats: number;
  targetGender: string;
  targetStages: string[];
  targetGrades: string[];
  registrationStart: string | null;
  registrationEnd: string | null;
  trainingStart: string | null;
  trainingEnd: string | null;
  registrationStatus?: string;
  canApply?: boolean;
  applyCode?: string | null;
  applyMessageAr?: string | null;
  applyMessageEn?: string | null;
  existingApplicationStatus?: string | null;
  studentApplication?: StudentTrainingApplicationSummary | null;
  seatsFull?: boolean;
  quota?: {
    seats: number;
    remainingSeats: number;
    acceptedCount: number;
    candidateCount: number;
    isFull: boolean;
  } | null;
  application?: ApplicationContext | null;
  communication?: CommunicationContext | null;
  certificate?: TrainingCertificateSummary | null;
  organization?: {
    name: string;
    city?: string;
    sector?: string;
    logo?: string;
  };
  institutionContact?: StudentInstitutionContactView | null;
};

const stageLabel = (stage: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    elementary: { ar: "ابتدائي", en: "Elementary" },
    middle: { ar: "متوسط", en: "Middle" },
    high: { ar: "ثانوي", en: "High" },
  };
  return map[stage]?.[isAr ? "ar" : "en"] || stage;
};

const genderLabel = (value: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    male: { ar: "بنين", en: "Male" },
    female: { ar: "بنات", en: "Female" },
    both: { ar: "الجميع", en: "All" },
  };
  return map[value]?.[isAr ? "ar" : "en"] || value;
};

const registrationStatusLabel = (status: string | undefined, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    open: { ar: "مفتوح", en: "Open" },
    not_started: { ar: "لم يبدأ", en: "Not started" },
    closed: { ar: "مغلق", en: "Closed" },
    unknown: { ar: "غير محدد", en: "Not specified" },
  };
  return map[String(status || "unknown")]?.[isAr ? "ar" : "en"] || status || "—";
};

const SummerTrainingDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [item, setItem] = useState<OpportunityDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editMessage, setEditMessage] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/student-opportunities?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed");
      }
      setItem(json.item || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (value: string | null) => {
    if (!value) return isAr ? "غير محدد" : "Not set";
    try {
      return new Date(value).toLocaleDateString(isAr ? "ar-SA" : "en-US");
    } catch {
      return value;
    }
  };

  const handleApply = async () => {
    if (!item || !item.canApply) return;
    setSubmitting(true);
    setApplyError(null);
    setApplySuccess(false);
    try {
      const res = await fetch("/api/partnerships/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: item.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (isAr ? json.messageAr : json.messageEn) ||
          (typeof json.error === "string" ? json.error : isAr ? "تعذر التقديم." : "Application failed.");
        throw new Error(message);
      }
      setApplySuccess(true);
      await load();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : isAr ? "تعذر التقديم." : "Application failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const applicationId = item?.application?.id;
    if (!applicationId) return;
    const confirmed = window.confirm(
      isAr ? "هل تريد إلغاء طلبك على هذه الفرصة؟" : "Do you want to withdraw your application?"
    );
    if (!confirmed) return;
    setWithdrawing(true);
    setApplyError(null);
    try {
      const res = await fetch(`/api/partnerships/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : isAr ? "تعذر الإلغاء." : "Withdraw failed.");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleOpenEdit = () => {
    if (!item?.application) return;
    setEditNotes(item.application.studentNotes || "");
    setEditMessage(item.application.applicationMessage || "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const applicationId = item?.application?.id;
    if (!applicationId) return;
    setSavingEdit(true);
    setApplyError(null);
    try {
      const res = await fetch(`/api/partnerships/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNotes: editNotes,
          applicationMessage: editMessage,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setEditOpen(false);
      await load();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : isAr ? "تعذر الحفظ." : "Save failed.");
    } finally {
      setSavingEdit(false);
    }
  };

  const application = item?.application;
  const studentApplication = item?.studentApplication;
  const status =
    application?.status || studentApplication?.status || item?.existingApplicationStatus || null;
  const hasApplicationRecord = Boolean(application?.id || studentApplication?.applicationId);
  const submittedAt = application?.submittedAt || studentApplication?.submittedAt || null;
  const lastUpdatedAt = application?.lastUpdatedAt || studentApplication?.lastUpdatedAt || null;
  const showApplyButton = !applySuccess && Boolean(item?.canApply) && !item?.seatsFull;
  const communication = item?.communication;
  const isAccepted = status === "accepted" || status === "completed";

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/summer-training"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          aria-label={isAr ? "العودة إلى القائمة" : "Back to list"}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isAr ? "العودة إلى الفرص" : "Back to opportunities"}
        </Link>
      </div>

      {loading ? (
        <p className="py-8 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
      ) : error || !item ? (
        <SectionCard>
          <p className="py-8 text-center text-red-600">
            {error || (isAr ? "تعذر العثور على الفرصة." : "Opportunity not found.")}
          </p>
        </SectionCard>
      ) : (
        <>
          {isAccepted ? (
            <TrainingAcceptedBanner
              organizationName={item.organization?.name || studentApplication?.organizationName || ""}
              isAr={isAr}
            />
          ) : null}

          <PageHeader
            title={item.title}
            subtitle={
              item.organization?.name
                ? `${item.organization.name}${item.organization.city ? ` · ${item.organization.city}` : ""}`
                : undefined
            }
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2">
              <h2 className="mb-3 text-base font-bold text-foreground">
                {isAr ? "وصف الفرصة" : "Opportunity description"}
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-text-light">
                {item.description || (isAr ? "لا يوجد وصف." : "No description provided.")}
              </p>

              <h2 className="mb-3 mt-6 text-base font-bold text-foreground">
                {isAr ? "شروط الفرصة" : "Opportunity conditions"}
              </h2>
              <ul className="space-y-2 text-sm text-text-light">
                <li>
                  {isAr ? "الجنس المستهدف:" : "Target gender:"}{" "}
                  <span className="font-semibold text-foreground">{genderLabel(item.targetGender, isAr)}</span>
                </li>
                <li>
                  {isAr ? "المراحل المستهدفة:" : "Target stages:"}{" "}
                  <span className="font-semibold text-foreground">
                    {item.targetStages.length > 0
                      ? item.targetStages.map((s) => stageLabel(s, isAr)).join(", ")
                      : isAr
                        ? "جميع المراحل"
                        : "All stages"}
                  </span>
                </li>
                <li>
                  {isAr ? "الصفوف المستهدفة:" : "Target grades:"}{" "}
                  <span className="font-semibold text-foreground">
                    {item.targetGrades.length > 0
                      ? item.targetGrades.map((g) => getGradeLabel(g, isAr ? "ar" : "en")).join(", ")
                      : isAr
                        ? "جميع الصفوف"
                        : "All grades"}
                  </span>
                </li>
              </ul>

              {hasApplicationRecord && application?.timeline?.length ? (
                <div className="mt-8">
                  <h2 className="mb-4 text-base font-bold text-foreground">
                    {isAr ? "جدول زمني للطلب" : "Application timeline"}
                  </h2>
                  <TrainingApplicationTimeline events={application?.timeline || []} isAr={isAr} />
                </div>
              ) : null}

              {item.certificate ? (
                <div className="mt-8">
                  <TrainingCertificateActions certificate={item.certificate} isAr={isAr} />
                </div>
              ) : null}

              {status === "completed" && application?.id ? (
                <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <h2 className="mb-2 text-base font-bold text-foreground">
                    {isAr ? "تقييم المؤسسة" : "Rate the organization"}
                  </h2>
                  <p className="mb-3 text-sm text-text-light">
                    {isAr
                      ? "شاركنا تجربتك بعد انتهاء التدريب."
                      : "Share your experience after completing training."}
                  </p>
                  <Link
                    href={`/summer-training/history/${application.id}`}
                    className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-95"
                  >
                    {isAr ? "تقييم المؤسسة" : "Submit feedback"}
                  </Link>
                </div>
              ) : null}

              {hasApplicationRecord && communication ? (
                <div className="mt-8 rounded-xl border border-border bg-gray-50/80 p-4">
                  <h2 className="mb-3 text-base font-bold text-foreground">
                    {isAr ? "متابعة الطلب والتواصل" : "Application follow-up"}
                  </h2>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="mb-1 text-text-light">{isAr ? "الحالة الحالية" : "Current status"}</dt>
                      <dd>
                        {status ? (
                          <TrainingApplicationStatusBadge status={String(status)} isAr={isAr} />
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-light">{isAr ? "رسائل غير مقروءة" : "Unread messages"}</dt>
                      <dd className="font-semibold text-foreground">{communication.unreadCount}</dd>
                    </div>
                    {communication.lastMessagePreview ? (
                      <div className="sm:col-span-2">
                        <dt className="text-text-light">{isAr ? "آخر رسالة" : "Last message"}</dt>
                        <dd className="mt-1 text-foreground">{communication.lastMessagePreview}</dd>
                        {communication.lastMessageAt ? (
                          <p className="mt-1 text-xs text-text-muted">
                            {new Date(communication.lastMessageAt).toLocaleString(isAr ? "ar-SA" : "en-GB")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </dl>
                  <Link
                    href="/summer-training/messages"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                    aria-label={isAr ? "فتح الرسائل" : "Open messages"}
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    {isAr ? "فتح الرسائل" : "Open messages"}
                  </Link>
                </div>
              ) : null}
            </SectionCard>

            <div className="space-y-4">
              <SectionCard>
                <h2 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "تفاصيل التدريب" : "Training details"}
                </h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <dt className="font-semibold text-foreground">{isAr ? "عدد المقاعد" : "Total seats"}</dt>
                      <dd className="text-text-light">{item.quota?.seats ?? item.seats}</dd>
                    </div>
                  </div>
                  {item.quota ? (
                    <>
                      <div className="flex items-start gap-2">
                        <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <div>
                          <dt className="font-semibold text-foreground">
                            {isAr ? "المقاعد المتبقية" : "Remaining seats"}
                          </dt>
                          <dd className="text-text-light">{item.quota.remainingSeats}</dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <div>
                          <dt className="font-semibold text-foreground">{isAr ? "عدد المتقدمين" : "Applicants"}</dt>
                          <dd className="text-text-light">{item.quota.candidateCount}</dd>
                        </div>
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <dt className="font-semibold text-foreground">{isAr ? "المؤسسة" : "Organization"}</dt>
                      <dd className="text-text-light">{item.organization?.name || "—"}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <dt className="font-semibold text-foreground">{isAr ? "فترة التسجيل" : "Registration period"}</dt>
                      <dd className="text-text-light">
                        {formatDate(item.registrationStart)} — {formatDate(item.registrationEnd)}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <dt className="font-semibold text-foreground">{isAr ? "الفترة الزمنية للتدريب" : "Training period"}</dt>
                      <dd className="text-text-light">
                        {formatDate(item.trainingStart)} — {formatDate(item.trainingEnd)}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <dt className="font-semibold text-foreground">{isAr ? "حالة التسجيل" : "Registration status"}</dt>
                      <dd className="text-text-light">{registrationStatusLabel(item.registrationStatus, isAr)}</dd>
                    </div>
                  </div>
                </dl>
              </SectionCard>

              {item.institutionContact ? (
                <StudentInstitutionContactCard institutionContact={item.institutionContact} isAr={isAr} />
              ) : null}

              <SectionCard id="apply">
                <h2 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "التقديم على الفرصة" : "Apply to this opportunity"}
                </h2>

                {applySuccess ? (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>{isAr ? "تم تقديم طلبك بنجاح." : "Your application was submitted successfully."}</p>
                  </div>
                ) : null}

                {hasApplicationRecord && status ? (
                  <TrainingApplicationStatusCard
                    status={String(status)}
                    submittedAt={submittedAt}
                    lastUpdatedAt={lastUpdatedAt}
                    isAr={isAr}
                  />
                ) : null}

                {status === "interview_requested" ? (
                  <p className="mb-3 text-sm text-violet-900">
                    {isAr ? "تم طلب مقابلة — " : "Interview requested — "}
                    <Link href="/summer-training/messages" className="font-semibold underline">
                      {isAr ? "راجع الرسائل" : "check your messages"}
                    </Link>
                  </p>
                ) : null}

                {applyError ? <p className="mb-3 text-sm text-red-600">{applyError}</p> : null}

                {!hasApplicationRecord && !applySuccess && item.seatsFull ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="status">
                    {isAr ? "المقاعد مكتملة" : "Seats are full"}
                  </p>
                ) : null}

                {showApplyButton ? (
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                    aria-label={isAr ? "تقديم على الفرصة" : "Apply to opportunity"}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                    {isAr ? "تقديم على الفرصة" : "Apply to opportunity"}
                  </button>
                ) : null}

                {!showApplyButton && !hasApplicationRecord && !applySuccess && !item.seatsFull ? (
                  <p className="text-sm text-amber-900" role="status">
                    {(isAr ? item.applyMessageAr : item.applyMessageEn) ||
                      (isAr ? "التقديم غير متاح حالياً." : "Application is not available right now.")}
                  </p>
                ) : null}

                {item.application?.canEdit ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleOpenEdit}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5"
                      aria-label={isAr ? "تعديل الطلب" : "Edit application"}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      {isAr ? "تعديل الطلب" : "Edit application"}
                    </button>
                    {item.application.canWithdraw ? (
                      <button
                        type="button"
                        onClick={() => void handleWithdraw()}
                        disabled={withdrawing}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        aria-label={isAr ? "إلغاء الطلب" : "Withdraw application"}
                      >
                        {withdrawing ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <XCircle className="h-4 w-4" aria-hidden />
                        )}
                        {isAr ? "إلغاء الطلب" : "Withdraw application"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {applySuccess ? (
                  <button
                    type="button"
                    onClick={() => router.push("/summer-training")}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold"
                  >
                    {isAr ? "العودة إلى الفرص" : "Back to opportunities"}
                  </button>
                ) : null}
              </SectionCard>
            </div>
          </div>

          {editOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label={isAr ? "تعديل الطلب" : "Edit application"}
            >
              <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="mb-4 text-lg font-bold text-foreground">
                  {isAr ? "تعديل الطلب" : "Edit application"}
                </h3>
                <label className="mb-3 block text-sm">
                  <span className="mb-1 block font-semibold text-foreground">
                    {isAr ? "رسالة التقديم" : "Application message"}
                  </span>
                  <textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  />
                </label>
                <label className="mb-4 block text-sm">
                  <span className="mb-1 block font-semibold text-foreground">
                    {isAr ? "ملاحظات الطالب" : "Student notes"}
                  </span>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveEdit()}
                    disabled={savingEdit}
                    className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {savingEdit ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "حفظ" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
};

export default SummerTrainingDetailPage;
