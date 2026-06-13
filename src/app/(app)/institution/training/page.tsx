"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import {
  trainingApplicationStatusBadgeClass,
  trainingApplicationStatusLabel,
} from "@/lib/partnerships/partnerships-application-status-ui";
import { Building2, CheckCircle2, Loader2, MessageSquare, XCircle } from "lucide-react";

type ApplicationItem = {
  id: string;
  status: string;
  institutionStatus: string;
  opportunityTitle: string;
  studentName: string;
  studentGrade: string;
  submittedAt: string | null;
  rejectionReason?: string;
};

type PortalPayload = {
  organization: { id: string; name: string; city: string; sector: string } | null;
  items: ApplicationItem[];
  counts: {
    new: number;
    inReview: number;
    accepted: number;
    rejected: number;
    interview: number;
    inProgress: number;
    completed: number;
  };
};

const InstitutionTrainingPortalPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalPayload | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<
    "new" | "inReview" | "accepted" | "rejected" | "interview" | "inProgress" | "completed"
  >("new");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/training/applications", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setData(json as PortalPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = async (applicationId: string, action: "accept" | "reject" | "interview") => {
    setSavingId(applicationId);
    setError(null);
    try {
      const res = await fetch(`/api/institution/training/applications/${encodeURIComponent(applicationId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: notesById[applicationId]?.trim() || undefined,
          rejectionReason: action === "reject" ? notesById[applicationId]?.trim() : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingId(null);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return isAr ? "—" : "—";
    try {
      return new Date(value).toLocaleDateString(isAr ? "ar-SA" : "en-US");
    } catch {
      return value;
    }
  };

  const tabs: Array<{ id: typeof activeTab; label: string; count: number }> = [
    { id: "new", label: isAr ? "طلبات جديدة" : "New applications", count: data?.counts.new ?? 0 },
    { id: "inReview", label: isAr ? "قيد المراجعة" : "In review", count: data?.counts.inReview ?? 0 },
    { id: "interview", label: isAr ? "مقابلات" : "Interviews", count: data?.counts.interview ?? 0 },
    { id: "accepted", label: isAr ? "مقبولة" : "Accepted", count: data?.counts.accepted ?? 0 },
    { id: "inProgress", label: isAr ? "تدريب جارٍ" : "In progress", count: data?.counts.inProgress ?? 0 },
    { id: "completed", label: isAr ? "تدريب مكتمل" : "Completed", count: data?.counts.completed ?? 0 },
    { id: "rejected", label: isAr ? "مرفوضة" : "Rejected", count: data?.counts.rejected ?? 0 },
  ];

  const filteredItems =
    data?.items.filter((row) => {
      if (activeTab === "new") {
        return row.status === "institution_review" && row.institutionStatus === "institution_pending";
      }
      if (activeTab === "inReview") {
        return (
          row.status === "institution_review" &&
          row.institutionStatus !== "institution_pending"
        );
      }
      if (activeTab === "accepted") return row.status === "accepted";
      if (activeTab === "rejected") return row.status === "rejected";
      if (activeTab === "interview") return row.status === "interview_requested";
      if (activeTab === "inProgress") return row.status === "accepted";
      if (activeTab === "completed") return row.status === "completed";
      return true;
    }) || [];

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "بوابة المؤسسة التدريبية" : "Training institution portal"}
        subtitle={
          data?.organization
            ? `${data.organization.name}${data.organization.city ? ` · ${data.organization.city}` : ""}`
            : isAr
              ? "مراجعة طلبات التدريب الصيفي"
              : "Review summer training applications"
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : error && !data ? (
        <SectionCard>
          <p className="py-8 text-center text-red-600">{error}</p>
        </SectionCard>
      ) : (
        <>
          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { key: "new", label: isAr ? "طلبات جديدة" : "New", value: data?.counts.new ?? 0 },
              { key: "interview", label: isAr ? "مقابلات" : "Interviews", value: data?.counts.interview ?? 0 },
              { key: "accepted", label: isAr ? "مقبولة" : "Accepted", value: data?.counts.accepted ?? 0 },
              { key: "rejected", label: isAr ? "مرفوضة" : "Rejected", value: data?.counts.rejected ?? 0 },
              { key: "inProgress", label: isAr ? "تدريب جارٍ" : "In progress", value: data?.counts.inProgress ?? 0 },
              { key: "completed", label: isAr ? "تدريب مكتمل" : "Completed", value: data?.counts.completed ?? 0 },
            ].map((card) => (
              <div
                key={card.key}
                className="rounded-2xl border border-border/70 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-bold text-text-light">{card.label}</p>
                <p className="mt-1 text-2xl font-black text-foreground">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  activeTab === tab.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-white text-text"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <SectionCard>
            {filteredItems.length === 0 ? (
              <p className="py-10 text-center text-text-light">
                {isAr ? "لا توجد طلبات في هذا القسم." : "No applications in this section."}
              </p>
            ) : (
              <ul className="space-y-4">
                {filteredItems.map((row) => (
                  <li key={row.id} className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-foreground">{row.studentName}</p>
                        <p className="text-sm text-text-light">
                          {row.opportunityTitle}
                          {row.studentGrade ? ` · ${isAr ? "الصف" : "Grade"} ${row.studentGrade}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-text-light">
                          {isAr ? "تاريخ التقديم:" : "Submitted:"} {formatDate(row.submittedAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${trainingApplicationStatusBadgeClass(row.status)}`}
                      >
                        {trainingApplicationStatusLabel(row.status, isAr)}
                      </span>
                    </div>

                    <div className="mt-3">
                      <Link
                        href={`/institution/training/${encodeURIComponent(row.id)}`}
                        className="text-sm font-bold text-primary hover:underline"
                      >
                        {isAr ? "عرض ملف الطالب" : "View student profile"}
                      </Link>
                    </div>

                    {row.status === "institution_review" ? (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={notesById[row.id] || ""}
                          onChange={(e) =>
                            setNotesById((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          placeholder={isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}
                          className="min-h-20 w-full rounded-xl border border-border px-3 py-2 text-sm"
                          aria-label={isAr ? "ملاحظات المؤسسة" : "Institution notes"}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={savingId === row.id}
                            onClick={() => void handleDecision(row.id, "accept")}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                            {isAr ? "قبول" : "Accept"}
                          </button>
                          <button
                            type="button"
                            disabled={savingId === row.id}
                            onClick={() => void handleDecision(row.id, "interview")}
                            className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-900 disabled:opacity-60"
                          >
                            <MessageSquare className="h-4 w-4" aria-hidden />
                            {isAr ? "طلب مقابلة" : "Request interview"}
                          </button>
                          <button
                            type="button"
                            disabled={savingId === row.id}
                            onClick={() => void handleDecision(row.id, "reject")}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-900 disabled:opacity-60"
                          >
                            <XCircle className="h-4 w-4" aria-hidden />
                            {isAr ? "رفض" : "Reject"}
                          </button>
                        </div>
                      </div>
                    ) : row.rejectionReason ? (
                      <p className="mt-3 text-sm text-red-800">
                        {isAr ? "سبب الرفض:" : "Rejection reason:"} {row.rejectionReason}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="mt-4 flex items-center gap-2 text-xs text-text-light">
            <Building2 className="h-4 w-4" aria-hidden />
            <span>
              {isAr
                ? "تُحدَّث حالات الطلبات تلقائياً في نظام التدريب الصيفي."
                : "Application statuses sync automatically with the summer training system."}
            </span>
          </div>
        </>
      )}
    </PageContainer>
  );
};

export default InstitutionTrainingPortalPage;
