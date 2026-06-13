"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { TRAINING_COMPLETION_STATUS_LABELS } from "@/lib/partnerships/training-completion-constants";
import { attachmentDisplayUrl } from "@/lib/partnerships/training-completion-upload";
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, XCircle } from "lucide-react";

type ReportRow = {
  id: string;
  status: string;
  studentName: string;
  opportunityTitle: string;
  organizationLabel: string;
  academicYear: string;
  submittedAt: string | null;
  volunteerHours: number | null;
  studentBenefitRating: number | null;
  videoUrl: string;
  reviewNotes: string;
  attachments: Array<{ id: string; fileName: string; storageKey: string; type: string }>;
  assignedTasks: string;
  studentReflection: string;
  institutionNotes: string;
};

type Dashboard = {
  submitted: number;
  pendingReview: number;
  approved: number;
  rejected: number;
};

const PartnershipsFinalReportsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReportRow[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>({
    submitted: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ReportRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const active = activeDetail;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/partnerships/final-reports?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setItems(Array.isArray(json.items) ? json.items : []);
      if (json.dashboard && typeof json.dashboard === "object") {
        setDashboard(json.dashboard as Dashboard);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReport = async (row: ReportRow) => {
    setActiveId(row.id);
    setReviewNote(row.reviewNotes || "");
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/final-reports/${encodeURIComponent(row.id)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setActiveDetail((json.item as ReportRow) || row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setActiveDetail(row);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (action: "approve" | "reject" | "request_changes") => {
    if (!activeId) return;
    if (action === "reject" && !reviewNote.trim()) {
      setError(isAr ? "ملاحظة الرفض مطلوبة" : "Rejection note is required");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/final-reports/${encodeURIComponent(activeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: reviewNote.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setReviewNote("");
      setActiveId(null);
      setActiveDetail(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setActing(false);
    }
  };

  const statusLabel = (value: string) =>
    TRAINING_COMPLETION_STATUS_LABELS[value as keyof typeof TRAINING_COMPLETION_STATUS_LABELS]?.[
      isAr ? "ar" : "en"
    ] || value;

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "تقارير التدريب النهائية" : "Final training reports"}
        subtitle={
          isAr ? "مراجعة واعتماد تقارير الطلاب بعد التدريب." : "Review and approve student training reports."
        }
      />

      <div className="mb-4">
        <Link
          href="/admin/partnerships/applications"
          className="inline-flex items-center gap-1 text-sm font-bold text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isAr ? "طلبات التدريب" : "Training applications"}
        </Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SectionCard className="!p-4">
          <p className="text-xs text-slate-500">{isAr ? "التقارير المرفوعة" : "Submitted reports"}</p>
          <p className="text-2xl font-black text-slate-900">{dashboard.submitted}</p>
        </SectionCard>
        <SectionCard className="!p-4">
          <p className="text-xs text-slate-500">{isAr ? "بانتظار المراجعة" : "Pending review"}</p>
          <p className="text-2xl font-black text-amber-700">{dashboard.pendingReview}</p>
        </SectionCard>
        <SectionCard className="!p-4">
          <p className="text-xs text-slate-500">{isAr ? "المعتمدة" : "Approved"}</p>
          <p className="text-2xl font-black text-emerald-700">{dashboard.approved}</p>
        </SectionCard>
        <SectionCard className="!p-4">
          <p className="text-xs text-slate-500">{isAr ? "المرفوضة" : "Rejected"}</p>
          <p className="text-2xl font-black text-red-700">{dashboard.rejected}</p>
        </SectionCard>
      </div>

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          aria-label={isAr ? "تصفية الحالة" : "Filter status"}
        >
          <option value="all">{isAr ? "كل الحالات" : "All statuses"}</option>
          <option value="pending">{statusLabel("pending")}</option>
          <option value="submitted">{statusLabel("submitted")}</option>
          <option value="under_review">{statusLabel("under_review")}</option>
          <option value="approved">{statusLabel("approved")}</option>
          <option value="rejected">{statusLabel("rejected")}</option>
        </select>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
              <ClipboardList className="h-5 w-5" aria-hidden />
              {isAr ? "جميع التقارير" : "All reports"}
            </h2>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {isAr ? "لا توجد تقارير." : "No reports yet."}
              </p>
            ) : (
              <ul className="max-h-[65vh] space-y-2 overflow-y-auto">
                {items.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => void openReport(row)}
                      className={`w-full rounded-xl border px-3 py-3 text-start text-sm transition ${
                        activeId === row.id
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <p className="font-bold text-slate-900">{row.studentName}</p>
                      <p className="text-xs text-slate-500">{row.opportunityTitle}</p>
                      <p className="mt-1 text-xs font-semibold text-primary">{statusLabel(row.status)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard>
            {detailLoading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
              </div>
            ) : !active ? (
              <p className="py-16 text-center text-slate-500">
                {isAr ? "اختر تقريراً للمراجعة." : "Select a report to review."}
              </p>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{active.studentName}</h3>
                  <p className="text-slate-600">
                    {active.opportunityTitle} · {active.organizationLabel}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isAr ? "الساعات:" : "Hours:"} {active.volunteerHours ?? "—"} ·{" "}
                    {isAr ? "الاستفادة:" : "Benefit:"} {active.studentBenefitRating ?? "—"}/5
                  </p>
                </div>
                <div>
                  <p className="font-bold text-slate-800">{isAr ? "المهام" : "Tasks"}</p>
                  <p className="whitespace-pre-wrap text-slate-700">{active.assignedTasks || "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-800">{isAr ? "أهم ما تعلمه" : "Reflection"}</p>
                  <p className="whitespace-pre-wrap text-slate-700">{active.studentReflection || "—"}</p>
                </div>
                {active.institutionNotes ? (
                  <div>
                    <p className="font-bold text-slate-800">{isAr ? "ملاحظات المؤسسة" : "Institution notes"}</p>
                    <p className="whitespace-pre-wrap text-slate-700">{active.institutionNotes}</p>
                  </div>
                ) : null}
                {active.videoUrl ? (
                  <a
                    href={active.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-primary underline"
                  >
                    {isAr ? "رابط الفيديو" : "Video link"}
                  </a>
                ) : null}
                {active.attachments.length > 0 ? (
                  <ul className="space-y-1">
                    {active.attachments.map((file) => (
                      <li key={file.id}>
                        <a
                          href={attachmentDisplayUrl(file.storageKey)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          {file.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {["submitted", "under_review", "rejected"].includes(active.status) ? (
                  <div className="border-t border-slate-100 pt-4">
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={3}
                      placeholder={isAr ? "ملاحظة المراجعة" : "Review note"}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleAction("approve")}
                        disabled={acting}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        {isAr ? "اعتماد" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAction("request_changes")}
                        disabled={acting}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-60"
                      >
                        {isAr ? "طلب تعديل" : "Request changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAction("reject")}
                        disabled={acting}
                        className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" aria-hidden />
                        {isAr ? "رفض" : "Reject"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default PartnershipsFinalReportsPage;
