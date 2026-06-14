"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import InstitutionBrandingHeader from "@/components/institution/InstitutionBrandingHeader";
import InstitutionCandidateComparison from "@/components/institution/InstitutionCandidateComparison";
import InstitutionCandidateScorecard from "@/components/institution/InstitutionCandidateScorecard";
import InstitutionRecruitmentAnalytics from "@/components/institution/InstitutionRecruitmentAnalytics";
import {
  CANDIDATE_TAG_LABELS,
  INSTITUTION_PIPELINE_STAGE_LABELS,
  INSTITUTION_PIPELINE_STAGES,
  type InstitutionPipelineStage,
  type PredefinedCandidateTag,
} from "@/lib/partnerships/institution-candidate-pipeline-constants";
import type { CandidateScorecard } from "@/lib/partnerships/institution-candidate-pipeline-service";
import {
  trainingApplicationStatusBadgeClass,
  trainingApplicationStatusLabel,
} from "@/lib/partnerships/partnerships-application-status-ui";
import {
  GitCompare,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquare,
  UserPlus,
  XCircle,
} from "lucide-react";

type ApplicationItem = {
  id: string;
  status: string;
  institutionStatus: string;
  pipelineStage: InstitutionPipelineStage;
  opportunityTitle: string;
  studentName: string;
  studentGrade: string;
  submittedAt: string | null;
  rejectionReason?: string;
  tags?: string[];
  scorecard: CandidateScorecard | null;
};

type AnalyticsPayload = {
  totalCandidates: number;
  acceptanceRatePct: number;
  rejectionRatePct: number;
  interviewCount: number;
  documentsRequested: number;
  finalReportsCount: number;
};

type PortalPayload = {
  organization: { id: string; name: string; city: string; sector: string; logo?: string } | null;
  profile?: {
    organization: {
      name: string;
      logo: string;
      sector: string;
      city: string;
      categoryLabelAr: string;
      categoryLabelEn: string;
    };
    metrics: {
      partnershipYears: number;
      historicallyTrainedStudents: number;
    };
  } | null;
  recentActivity?: Array<{
    id: string;
    kind: string;
    labelAr: string;
    labelEn: string;
    at: string | null;
    applicationId?: string;
  }>;
  items: ApplicationItem[];
  counts: Record<InstitutionPipelineStage, number>;
  stageCounts: Record<InstitutionPipelineStage, number>;
  analytics: AnalyticsPayload | null;
};

const LEGACY_TAB_MAP: Record<string, InstitutionPipelineStage> = {
  new: "new",
  inReview: "inReview",
  interview: "awaitingInterview",
  accepted: "accepted",
  rejected: "rejected",
  inProgress: "inTraining",
  completed: "completed",
};

const tagLabel = (tag: string, isAr: boolean) => {
  const predefined = CANDIDATE_TAG_LABELS[tag as PredefinedCandidateTag];
  if (predefined) return isAr ? predefined.ar : predefined.en;
  return tag;
};

const InstitutionTrainingPortalPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: InstitutionPipelineStage =
    tabParam && (INSTITUTION_PIPELINE_STAGES as readonly string[]).includes(tabParam)
      ? (tabParam as InstitutionPipelineStage)
      : tabParam && LEGACY_TAB_MAP[tabParam]
        ? LEGACY_TAB_MAP[tabParam]
        : "new";
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalPayload | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<InstitutionPipelineStage>(initialTab);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/dashboard", { cache: "no-store" });
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

  const stageCounts = data?.stageCounts || data?.counts;

  const tabs: Array<{ id: InstitutionPipelineStage; label: string; count: number }> =
    INSTITUTION_PIPELINE_STAGES.map((id) => ({
      id,
      label: INSTITUTION_PIPELINE_STAGE_LABELS[id][isAr ? "ar" : "en"],
      count: stageCounts?.[id] ?? 0,
    }));

  const filteredItems = data?.items.filter((row) => row.pipelineStage === activeTab) || [];

  const handleToggleCompare = (applicationId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(applicationId)) return prev.filter((id) => id !== applicationId);
      if (prev.length >= 6) return prev;
      return [...prev, applicationId];
    });
  };

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
      ) : !data ? (
        <SectionCard>
          <p className="py-8 text-center text-text-light">
            {isAr ? "لا توجد بيانات." : "No data available."}
          </p>
        </SectionCard>
      ) : (
        <>
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          {data.profile?.organization ? (
            <div className="mb-4">
              <InstitutionBrandingHeader
                isAr={isAr}
                compact
                data={{
                  name: data.profile.organization.name,
                  logo: data.profile.organization.logo,
                  sector: data.profile.organization.sector,
                  categoryLabelAr: data.profile.organization.categoryLabelAr,
                  categoryLabelEn: data.profile.organization.categoryLabelEn,
                  city: data.profile.organization.city,
                  partnershipYears: data.profile.metrics.partnershipYears,
                  historicallyTrainedStudents: data.profile.metrics.historicallyTrainedStudents,
                }}
              />
            </div>
          ) : null}

          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_280px]">
            <SectionCard padding="sm">
              <h3 className="mb-3 text-sm font-bold text-foreground">
                {isAr ? "النشاط الحديث" : "Recent activity"}
              </h3>
              {(data.recentActivity || []).length === 0 ? (
                <p className="text-xs text-text-light">
                  {isAr ? "لا يوجد نشاط حديث." : "No recent activity."}
                </p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {(data.recentActivity || []).slice(0, 8).map((row) => (
                    <li key={row.id} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                      <p className="font-semibold text-foreground">{isAr ? row.labelAr : row.labelEn}</p>
                      {row.applicationId ? (
                        <Link
                          href={`/institution/training/${encodeURIComponent(row.applicationId)}`}
                          className="text-primary hover:underline"
                        >
                          {isAr ? "عرض" : "View"}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard padding="sm">
              <h3 className="mb-3 text-sm font-bold text-foreground">
                {isAr ? "إجراءات سريعة" : "Quick actions"}
              </h3>
              <div className="grid gap-2">
                <Link
                  href="/institution/training?tab=new"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-gray-50"
                >
                  <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {isAr ? "طلاب جدد" : "New candidates"} ({stageCounts?.new ?? 0})
                </Link>
                <Link
                  href="/institution/training/messages"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-gray-50"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {isAr ? "الرسائل" : "Messages"}
                </Link>
                <Link
                  href="/institution/training?tab=awaitingInterview"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-gray-50"
                >
                  <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {isAr ? "المقابلات" : "Interviews"} ({stageCounts?.awaitingInterview ?? 0})
                </Link>
                <Link
                  href="/institution/training?tab=inTraining"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-gray-50"
                >
                  <ClipboardList className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {isAr ? "التقييمات" : "Evaluations"}
                </Link>
                <Link
                  href="/institution/training?tab=completed"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-gray-50"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {isAr ? "التقارير النهائية" : "Final reports"}
                </Link>
              </div>
            </SectionCard>
          </div>

          <div className="mb-4">
            <InstitutionRecruitmentAnalytics analytics={data.analytics} isAr={isAr} />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-light">
              {isAr ? "اختر 2–6 مرشحين للمقارنة" : "Select 2–6 candidates to compare"}
            </p>
            {compareIds.length >= 2 ? (
              <button
                type="button"
                onClick={() => setShowComparison(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
              >
                <GitCompare className="h-4 w-4" aria-hidden />
                {isAr ? `مقارنة (${compareIds.length})` : `Compare (${compareIds.length})`}
              </button>
            ) : null}
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
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={compareIds.includes(row.id)}
                          onChange={() => handleToggleCompare(row.id)}
                          aria-label={isAr ? "اختيار للمقارنة" : "Select for comparison"}
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <div>
                          <p className="text-lg font-bold text-foreground">{row.studentName}</p>
                          <p className="text-sm text-text-light">
                            {row.opportunityTitle}
                            {row.studentGrade ? ` · ${isAr ? "الصف" : "Grade"} ${row.studentGrade}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-text-light">
                            {isAr ? "تاريخ التقديم:" : "Submitted:"} {formatDate(row.submittedAt)}
                          </p>
                          {(row.tags || []).length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(row.tags || []).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-bold text-primary"
                                >
                                  {tagLabel(tag, isAr)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${trainingApplicationStatusBadgeClass(row.status)}`}
                        >
                          {trainingApplicationStatusLabel(row.status, isAr)}
                        </span>
                        <InstitutionCandidateScorecard scorecard={row.scorecard} isAr={isAr} compact />
                      </div>
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
                ? "مراحل المرشحين تُشتق من حالة الطلب والمستندات والمقابلات — دون تغيير سير العمل."
                : "Candidate stages are derived from application status, documents, and interviews — without changing workflow."}
            </span>
          </div>

          {showComparison ? (
            <InstitutionCandidateComparison
              selectedIds={compareIds}
              isAr={isAr}
              onClose={() => setShowComparison(false)}
            />
          ) : null}
        </>
      )}
    </PageContainer>
  );
};

export default InstitutionTrainingPortalPage;
