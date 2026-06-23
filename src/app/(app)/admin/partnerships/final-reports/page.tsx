"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { TRAINING_COMPLETION_STATUS_LABELS } from "@/lib/partnerships/training-completion-constants";
import { attachmentDisplayUrl } from "@/lib/partnerships/training-completion-upload";
import { pickInstitutionReportValidationView } from "@/lib/partnerships/institution-final-report-validation-ui";
import { computeFinalReportReviewEmptyStateStats } from "@/lib/partnerships/final-report-review-empty-state-stats";
import {
  buildConsistencyCauses,
  humanizeValidationFailure,
  isReviewNoteSufficient,
} from "@/lib/partnerships/final-report-review-ux-constants";
import TrainingConsistencyPanel from "@/components/partnerships/TrainingConsistencyPanel";
import InstitutionReportValidationCard from "@/components/partnerships/InstitutionReportValidationCard";
import InstitutionReportPreviewActions from "@/components/partnerships/InstitutionReportPreviewActions";
import InstitutionReportValidationDiagnosticsPanel from "@/components/partnerships/InstitutionReportValidationDiagnosticsPanel";
import InstitutionReportVisualEvidencePanel from "@/components/partnerships/InstitutionReportVisualEvidencePanel";
import FinalReportReviewNoteField, {
  runReviewNoteClientValidation,
  type FinalReportReviewNoteFieldHandle,
} from "@/components/partnerships/FinalReportReviewNoteField";
import FinalReportApprovalOverrideDialog from "@/components/partnerships/FinalReportApprovalOverrideDialog";
import FinalReportReviewEmptyState from "@/components/partnerships/FinalReportReviewEmptyState";
import type { InstitutionReportValidationDiagnostics } from "@/lib/partnerships/institution-final-report-validation-diagnostics";
import type { TrainingReportIntelligence } from "@/lib/partnerships/training-intelligence-types";
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
  positionTitle: string;
  numberOfTrainees: number | null;
  supervisorCooperationRating: number | null;
  practicalBenefitRating: number | null;
  workEnvironmentRating: number | null;
  recommendInstitutionToPeers: boolean | null;
  biggestChallenge: string;
  challengeResponse: string;
  wishedToLearn: string;
  futureImpact: string;
  videoUrl: string;
  reviewNotes: string;
  attachments: Array<{ id: string; fileName: string; storageKey: string; type: string }>;
  assignedTasks: string;
  studentReflection: string;
  institutionNotes: string;
  institutionReportFileKey: string;
  institutionReportFileName?: string;
  institutionReportExtraction: Record<string, unknown> | null;
  validationDiagnostics?: InstitutionReportValidationDiagnostics | null;
  revisionReason?: string;
  revisionRequestedAt?: string | null;
  trainingIntelligence?: TrainingReportIntelligence | null;
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
  const [manualVerifyLoading, setManualVerifyLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
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
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [noteValidationError, setNoteValidationError] = useState<string | null>(null);
  const [noteShake, setNoteShake] = useState(false);
  const reviewNoteRef = useRef<FinalReportReviewNoteFieldHandle>(null);

  const emptyStateStats = useMemo(() => computeFinalReportReviewEmptyStateStats(items), [items]);

  const active = activeDetail;
  const institutionReviewStatus =
    active?.institutionReportExtraction &&
    typeof active.institutionReportExtraction.validationResult === "object"
      ? String(
          (active.institutionReportExtraction.validationResult as Record<string, unknown>).reviewStatus ||
            active.institutionReportExtraction.reviewStatus ||
            ""
        )
      : String(active?.institutionReportExtraction?.reviewStatus || "");
  const requiresReviewOverride = institutionReviewStatus === "REQUIRES_REVIEW";
  const validationView = pickInstitutionReportValidationView(active?.institutionReportExtraction);
  const validationConfidence =
    validationView?.validationResult?.overallConfidence ??
    validationView?.validationResult?.confidence ??
    validationView?.overallConfidence ??
    validationView?.confidenceScore ??
    null;
  const overrideIssuesSummary = useMemo(() => {
    const issues: string[] = [];
    const diagnostics = active?.validationDiagnostics;
    if (diagnostics?.ocrError) {
      issues.push(
        humanizeValidationFailure(
          diagnostics.ocrError,
          locale,
          diagnostics.failureReasonAr,
          diagnostics.failureReasonEn
        ) || diagnostics.ocrError
      );
    }
    if (diagnostics?.visionError) {
      issues.push(
        humanizeValidationFailure(
          diagnostics.visionError,
          locale,
          diagnostics.failureReasonAr,
          diagnostics.failureReasonEn
        ) || diagnostics.visionError
      );
    }
    const warnings = validationView?.validationResult?.warnings ?? [];
    for (const warning of warnings) issues.push(String(warning));
    if (active?.trainingIntelligence) {
      issues.push(...buildConsistencyCauses(active.trainingIntelligence, locale));
    }
    return [...new Set(issues)].slice(0, 8);
  }, [active, locale, validationView]);

  const noteReady = isReviewNoteSufficient(reviewNote);

  const triggerNoteValidation = (action: "request_changes" | "reject") => {
    const result = runReviewNoteClientValidation(reviewNote, action, locale);
    if (result.valid) {
      setNoteValidationError(null);
      return true;
    }
    setNoteValidationError(result.message);
    setNoteShake(true);
    reviewNoteRef.current?.focus();
    reviewNoteRef.current?.scrollIntoView();
    window.setTimeout(() => setNoteShake(false), 500);
    return false;
  };

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

  const handleDetectionFeedback = async (target: "stamp" | "signature" | "rating", ratingKey?: string) => {
    if (!activeId) return;
    setFeedbackLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/final-reports/${encodeURIComponent(activeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionDetectionFeedbackTarget: target,
          ratingKey: ratingKey || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setActiveDetail((json.item as ReportRow) || activeDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleManualVerification = async () => {
    if (!activeId) return;
    setManualVerifyLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/final-reports/${encodeURIComponent(activeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualInstitutionVerification: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setActiveDetail((json.item as ReportRow) || activeDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setManualVerifyLoading(false);
    }
  };

  const handleAction = async (action: "approve" | "reject" | "request_changes", approveOverride = false) => {
    if (!activeId) return;
    if (action === "reject" && !triggerNoteValidation("reject")) return;
    if (action === "request_changes" && !triggerNoteValidation("request_changes")) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/final-reports/${encodeURIComponent(activeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: reviewNote.trim() || undefined,
          approveOverride: action === "approve" ? approveOverride : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setReviewNote("");
      setNoteValidationError(null);
      setApproveConfirmOpen(false);
      setActiveId(null);
      setActiveDetail(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setActing(false);
    }
  };

  const handleApproveClick = () => {
    if (requiresReviewOverride) {
      setApproveConfirmOpen(true);
      return;
    }
    void handleAction("approve");
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
          <option value="needs_revision">{statusLabel("needs_revision")}</option>
          <option value="resubmitted">{statusLabel("resubmitted")}</option>
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
              <FinalReportReviewEmptyState stats={emptyStateStats} locale={locale} />
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
                    {active.positionTitle ? (
                      <>
                        {" "}
                        · {isAr ? "المنصب:" : "Position:"} {active.positionTitle}
                      </>
                    ) : null}
                  </p>
                </div>
                {active.numberOfTrainees != null ? (
                  <p className="text-xs text-slate-500">
                    {isAr ? "عدد زملاء التدريب:" : "Fellow trainees:"} {active.numberOfTrainees}
                  </p>
                ) : null}
                <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                  <p>
                    {isAr ? "تعاون المشرف:" : "Supervisor:"}{" "}
                    {active.supervisorCooperationRating ?? "—"}/5
                  </p>
                  <p>
                    {isAr ? "الاستفادة العملية:" : "Practical:"}{" "}
                    {active.practicalBenefitRating ?? "—"}/5
                  </p>
                  <p>
                    {isAr ? "بيئة العمل:" : "Environment:"}{" "}
                    {active.workEnvironmentRating ?? "—"}/5
                  </p>
                  {typeof active.recommendInstitutionToPeers === "boolean" ? (
                    <p className="sm:col-span-3">
                      {isAr ? "يوصي الزملاء:" : "Recommends to peers:"}{" "}
                      {active.recommendInstitutionToPeers ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No"}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{isAr ? "المهام" : "Tasks"}</p>
                  <p className="whitespace-pre-wrap text-slate-700">{active.assignedTasks || "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-800">{isAr ? "أهم ما تعلمه" : "Reflection"}</p>
                  <p className="whitespace-pre-wrap text-slate-700">{active.studentReflection || "—"}</p>
                </div>
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <p className="font-bold text-slate-800">
                    {isAr ? "التأمل والنمو الشخصي" : "Reflection & growth"}
                  </p>
                  {[
                    { labelAr: "أكبر تحدٍ", labelEn: "Biggest challenge", value: active.biggestChallenge },
                    { labelAr: "التعامل مع التحدي", labelEn: "Challenge response", value: active.challengeResponse },
                    { labelAr: "ما تمنى تعلمه", labelEn: "Wished to learn", value: active.wishedToLearn },
                    { labelAr: "الأثر المستقبلي", labelEn: "Future impact", value: active.futureImpact },
                  ].map((row) => (
                    <div key={row.labelEn}>
                      <p className="text-xs font-bold text-slate-600">{isAr ? row.labelAr : row.labelEn}</p>
                      <p className="whitespace-pre-wrap text-slate-700">{row.value || "—"}</p>
                    </div>
                  ))}
                </div>
                {active.institutionNotes ? (
                  <div>
                    <p className="font-bold text-slate-800">{isAr ? "ملاحظات المؤسسة" : "Institution notes"}</p>
                    <p className="whitespace-pre-wrap text-slate-700">{active.institutionNotes}</p>
                  </div>
                ) : null}
                <InstitutionReportPreviewActions
                  fileName={active.institutionReportFileName || ""}
                  fileKey={active.institutionReportFileKey}
                  locale={locale}
                />
                <InstitutionReportValidationDiagnosticsPanel
                  diagnostics={active.validationDiagnostics}
                  extraction={active.institutionReportExtraction}
                  locale={locale}
                />
                <InstitutionReportValidationCard
                  extraction={pickInstitutionReportValidationView(active.institutionReportExtraction)}
                  validationDiagnostics={active.validationDiagnostics}
                  locale={locale}
                  recordId={activeId}
                  onManualVerify={handleManualVerification}
                  manualVerifyLoading={manualVerifyLoading}
                />
                <InstitutionReportVisualEvidencePanel
                  extractionMeta={active.institutionReportExtraction}
                  reportFileKey={active.institutionReportFileKey}
                  locale={locale}
                  recordId={activeId}
                  onDetectionFeedback={handleDetectionFeedback}
                  feedbackLoading={feedbackLoading}
                />
                <TrainingConsistencyPanel intelligence={active.trainingIntelligence} locale={locale} />
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

                {["submitted", "under_review", "resubmitted", "rejected"].includes(active.status) ? (
                  <div className="border-t border-slate-100 pt-4">
                    <FinalReportReviewNoteField
                      ref={reviewNoteRef}
                      value={reviewNote}
                      onChange={(value) => {
                        setReviewNote(value);
                        if (noteValidationError) setNoteValidationError(null);
                      }}
                      locale={locale}
                      validationError={noteValidationError}
                      shake={noteShake}
                    />
                    {requiresReviewOverride ? (
                      <p className="mt-2 text-xs font-semibold text-orange-800" role="status">
                        {isAr
                          ? "تقرير المؤسسة يحتاج مراجعة — الاعتماد يتطلب تأكيداً صريحاً."
                          : "Institution report requires review — approval needs explicit override."}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleApproveClick}
                        disabled={acting}
                        aria-label={isAr ? "اعتماد التقرير" : "Approve report"}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        {isAr ? "اعتماد" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAction("request_changes")}
                        disabled={acting || !noteReady}
                        aria-label={isAr ? "طلب تعديل" : "Request changes"}
                        className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800 hover:bg-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60"
                      >
                        {isAr ? "طلب تعديل" : "Request changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAction("reject")}
                        disabled={acting || !noteReady}
                        aria-label={isAr ? "رفض التقرير" : "Reject report"}
                        className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" aria-hidden />
                        {isAr ? "رفض" : "Reject"}
                      </button>
                    </div>
                    <FinalReportApprovalOverrideDialog
                      open={approveConfirmOpen}
                      locale={locale}
                      acting={acting}
                      validationConfidence={validationConfidence}
                      consistencyScore={active.trainingIntelligence?.consistencyScore ?? null}
                      issuesSummary={overrideIssuesSummary}
                      onConfirm={() => void handleAction("approve", true)}
                      onCancel={() => setApproveConfirmOpen(false)}
                    />
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
