"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import InstitutionStudentProfileCard from "@/components/institution/InstitutionStudentProfileCard";
import InstitutionContactAccessCard from "@/components/institution/InstitutionContactAccessCard";
import InstitutionCandidateScorecard from "@/components/institution/InstitutionCandidateScorecard";
import InstitutionDocumentTracker from "@/components/institution/InstitutionDocumentTracker";
import InstitutionInterviewWorkspace from "@/components/institution/InstitutionInterviewWorkspace";
import InstitutionPrivateNotesPanel from "@/components/institution/InstitutionPrivateNotesPanel";
import InstitutionCandidateTagsPanel from "@/components/institution/InstitutionCandidateTagsPanel";
import InstitutionEvaluationCenter from "@/components/institution/InstitutionEvaluationCenter";
import InstitutionFinalEvaluationPanel from "@/components/institution/InstitutionFinalEvaluationPanel";
import InstitutionCandidateWorkspace from "@/components/institution/InstitutionCandidateWorkspace";
import type { InstitutionContactAccessView } from "@/components/institution/InstitutionContactAccessCard";
import InstitutionParentConsentPanel from "@/components/partnerships/InstitutionParentConsentPanel";
import TrainingApplicationTimeline from "@/components/partnerships/TrainingApplicationTimeline";
import TrainingApplicationStatusBadge from "@/components/partnerships/TrainingApplicationStatusBadge";
import { getLocale } from "@/lib/i18n";
import { INSTITUTION_ADMIN_CANCELLED_MESSAGE } from "@/lib/partnerships/partnerships-admin-cancel-constants";
import type { InstitutionStudentProfileSummary } from "@/lib/partnerships/institution-student-profile-service";
import type { CandidateScorecard } from "@/lib/partnerships/institution-candidate-pipeline-service";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";

type ApplicationDetail = {
  id: string;
  status: string;
  institutionReadOnly?: boolean;
  administrativelyCancelled?: boolean;
  adminCancellationReason?: string | null;
  opportunityTitle: string;
  submittedAt: string | null;
  rejectionReason?: string;
  timeline: Array<{ at: string | null; action: string; note: string; actorName: string }>;
  studentProfile: InstitutionStudentProfileSummary;
  scorecard: CandidateScorecard | null;
  documentTracker: Array<{ id: string; titleAr: string; titleEn: string; status: string }>;
  tags: Array<{ id: string; tag: string }>;
  privateNotes: Array<{ id: string; category: string; body: string; createdAt: string | null }>;
  requirements: Array<{
    id: string;
    requirementType?: string;
    title: string;
    description?: string;
    status: string;
    dueDate: string | null;
    submittedAt?: string | null;
    aiVerification?: import("@/lib/partnerships/parent-consent-verification-constants").ParentConsentAiVerification | null;
  }>;
  interviews: Array<{
    id: string;
    scheduledAt: string;
    status: string;
    location: string;
    meetingUrl: string;
    notes: string;
    recordingUrl?: string;
    attendance?: string;
    resultNotes?: string;
  }>;
  assessments: Array<{ id: string; title: string; type: string; status: string }>;
  evaluation: {
    finalRecommendation: string;
    institutionNotes: string;
  } | null;
  contactAccess: InstitutionContactAccessView;
};

const InstitutionApplicationDetailPage = () => {
  const params = useParams();
  const applicationId = String(params.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [reqTitle, setReqTitle] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [assessmentTitle, setAssessmentTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/institution/training/applications/${encodeURIComponent(applicationId)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setDetail(json.application as ApplicationDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (applicationId) void load();
  }, [applicationId, load]);

  const postAction = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/institution/training/applications/${encodeURIComponent(applicationId)}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = (action: "accept" | "reject" | "interview") =>
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/institution/training/applications/${encodeURIComponent(applicationId)}/decision`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              notes: notes.trim() || undefined,
              rejectionReason: action === "reject" ? notes.trim() : undefined,
            }),
          }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setSaving(false);
      }
    })();

  return (
    <PageContainer>
      <Link
        href="/institution/training"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <BackIcon className="h-4 w-4" aria-hidden />
        {isAr ? "العودة للطلبات" : "Back to applications"}
      </Link>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : !detail ? (
        <SectionCard>
          <p className="py-8 text-center text-red-600">{error || (isAr ? "غير موجود" : "Not found")}</p>
        </SectionCard>
      ) : (
        <>
          <PageHeader
            title={detail.studentProfile.basic.fullName}
            subtitle={detail.opportunityTitle}
            actions={<TrainingApplicationStatusBadge status={detail.status} isAr={isAr} />}
          />

          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

          {detail.institutionReadOnly ? (
            <SectionCard className="mb-4 border-amber-300 bg-amber-50">
              <p className="text-sm font-semibold text-amber-950">
                {isAr ? INSTITUTION_ADMIN_CANCELLED_MESSAGE.ar : INSTITUTION_ADMIN_CANCELLED_MESSAGE.en}
              </p>
              {detail.adminCancellationReason ? (
                <p className="mt-1 text-xs text-amber-900">{detail.adminCancellationReason}</p>
              ) : null}
              <p className="mt-2 text-xs text-amber-900">
                {isAr ? "هذا الطلب للعرض فقط — لا يمكن تنفيذ إجراءات جديدة." : "This application is read-only — no new actions are allowed."}
              </p>
            </SectionCard>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <InstitutionStudentProfileCard profile={detail.studentProfile} isAr={isAr} />

              <InstitutionCandidateScorecard scorecard={detail.scorecard} isAr={isAr} />

              <SectionCard>
                <h3 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "لوحة قرار المؤسسة" : "Institution decision workspace"}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {detail.status === "institution_review" && !detail.institutionReadOnly ? (
                    <>
                      <button type="button" disabled={saving} onClick={() => void handleDecision("accept")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-900">
                        {isAr ? "قبول الطالب" : "Accept student"}
                      </button>
                      <button type="button" disabled={saving} onClick={() => void handleDecision("reject")} className="rounded-xl border border-red-300 bg-red-50 px-3 py-3 text-sm font-bold text-red-900">
                        {isAr ? "رفض الطالب" : "Reject student"}
                      </button>
                      <button type="button" disabled={saving} onClick={() => void handleDecision("interview")} className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-3 text-sm font-bold text-violet-900">
                        {isAr ? "طلب مقابلة" : "Request interview"}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving || detail.institutionReadOnly || !reqTitle.trim()}
                    onClick={() => void postAction({ action: "create_requirement", title: reqTitle.trim() }).then(() => setReqTitle(""))}
                    className="rounded-xl border border-border bg-white px-3 py-3 text-sm font-bold"
                  >
                    {isAr ? "طلب مستند" : "Request document"}
                  </button>
                  <Link href={`/institution/training/messages?applicationId=${encodeURIComponent(applicationId)}`} className="rounded-xl border border-primary bg-primary/10 px-3 py-3 text-center text-sm font-bold text-primary">
                    {isAr ? "إرسال رسالة" : "Send message"}
                  </Link>
                  <button
                    type="button"
                    disabled={saving || detail.institutionReadOnly || !assessmentTitle.trim()}
                    onClick={() => void postAction({ action: "create_assessment", type: "upload_task", title: assessmentTitle.trim() }).then(() => setAssessmentTitle(""))}
                    className="rounded-xl border border-border bg-white px-3 py-3 text-sm font-bold"
                  >
                    {isAr ? "إنشاء تقييم" : "Create assessment"}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    value={reqTitle}
                    onChange={(e) => setReqTitle(e.target.value)}
                    placeholder={isAr ? "عنوان المستند المطلوب" : "Document title"}
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <input
                    value={assessmentTitle}
                    onChange={(e) => setAssessmentTitle(e.target.value)}
                    placeholder={isAr ? "عنوان التقييم" : "Assessment title"}
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  />
                </div>
                {detail.status === "institution_review" ? (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isAr ? "ملاحظات القرار" : "Decision notes"}
                    className="mt-3 min-h-20 w-full rounded-xl border border-border px-3 py-2 text-sm"
                  />
                ) : null}
              </SectionCard>

              <InstitutionParentConsentPanel
                applicationId={applicationId}
                requirements={detail.requirements.map((row) => ({
                  id: row.id,
                  requirementType: row.requirementType || "general",
                  title: row.title,
                  description: row.description || "",
                  status: row.status,
                  submittedAt: row.submittedAt || null,
                  institutionConsentStatus:
                    "institutionConsentStatus" in row
                      ? (row as { institutionConsentStatus?: { status: string; labelAr: string; labelEn: string } | null })
                          .institutionConsentStatus
                      : null,
                }))}
                isAr={isAr}
                onUpdated={load}
                postAction={postAction}
                saving={saving}
                viewMode="institution"
              />

              <InstitutionCandidateWorkspace
                isAr={isAr}
                documents={
                  <div className="space-y-3">
                    <InstitutionDocumentTracker documents={detail.documentTracker} isAr={isAr} />
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={reqTitle}
                        onChange={(e) => setReqTitle(e.target.value)}
                        placeholder={isAr ? "عنوان مستند إضافي" : "Additional document title"}
                        className="min-w-[200px] flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={saving || detail.institutionReadOnly || !reqTitle.trim()}
                        onClick={() => void postAction({ action: "create_requirement", title: reqTitle.trim() }).then(() => setReqTitle(""))}
                        className="rounded-xl border border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary disabled:opacity-60"
                      >
                        {isAr ? "طلب مستند" : "Request document"}
                      </button>
                    </div>
                  </div>
                }
                interviews={
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="datetime-local"
                        value={interviewAt}
                        onChange={(e) => setInterviewAt(e.target.value)}
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={saving || detail.institutionReadOnly || !interviewAt}
                        onClick={() =>
                          void postAction({
                            action: "schedule_interview",
                            scheduledAt: new Date(interviewAt).toISOString(),
                          }).then(() => setInterviewAt(""))
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-900 disabled:opacity-60"
                      >
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {isAr ? "جدولة مقابلة" : "Schedule interview"}
                      </button>
                    </div>
                    <InstitutionInterviewWorkspace
                      applicationId={applicationId}
                      interviews={detail.interviews}
                      isAr={isAr}
                      onUpdated={load}
                    />
                  </div>
                }
                messagesLink={
                  <Link
                    href={`/institution/training/messages?applicationId=${encodeURIComponent(applicationId)}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    {isAr ? "فتح المحادثة" : "Open conversation"}
                  </Link>
                }
                tags={
                  <InstitutionCandidateTagsPanel
                    applicationId={applicationId}
                    tags={detail.tags}
                    isAr={isAr}
                    onUpdated={load}
                  />
                }
                notes={
                  <InstitutionPrivateNotesPanel
                    applicationId={applicationId}
                    notes={detail.privateNotes}
                    isAr={isAr}
                    onUpdated={load}
                  />
                }
                evaluation={
                  <InstitutionEvaluationCenter
                    applicationId={applicationId}
                    applicationStatus={detail.status}
                    assessments={detail.assessments}
                    isAr={isAr}
                    readOnly={detail.institutionReadOnly}
                    assessmentTitle={assessmentTitle}
                    onAssessmentTitleChange={setAssessmentTitle}
                    saving={saving}
                    onCreateAssessment={(title) =>
                      void postAction({ action: "create_assessment", type: "upload_task", title }).then(() =>
                        setAssessmentTitle("")
                      )
                    }
                    onUpdated={load}
                  />
                }
                finalReport={
                  ["accepted", "awaiting_school_approval", "completed", "awaiting_final_evaluation_review", "final_evaluation_approved", "final_evaluation_rejected"].includes(
                    detail.status
                  ) ? (
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-bold text-foreground">
                          {isAr ? "التقرير النهائي للتدريب" : "Final training report"}
                        </h3>
                        <p className="text-xs text-text-light">
                          {isAr
                            ? "تقييم المؤسسة النهائي للطالب — منفصل عن التقييمات الدورية."
                            : "Institution final trainee assessment — separate from periodic evaluations."}
                        </p>
                      </div>
                      <InstitutionFinalEvaluationPanel
                        applicationId={applicationId}
                        isAr={isAr}
                        readOnly={detail.institutionReadOnly}
                        onSubmitted={load}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-text-light">
                      {isAr
                        ? "يُفعّل التقرير النهائي بعد قبول الطالب."
                        : "Final report unlocks after the student is accepted."}
                    </p>
                  )
                }
              />
            </div>

            <div className="space-y-6">
              {detail.contactAccess ? (
                <InstitutionContactAccessCard contactAccess={detail.contactAccess} isAr={isAr} />
              ) : null}

              <SectionCard>
                <h3 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "الجدول الزمني" : "Timeline"}
                </h3>
                <TrainingApplicationTimeline
                  events={detail.timeline.map((row) => ({
                    at: row.at,
                    action: row.action,
                    note: row.note,
                  }))}
                  isAr={isAr}
                />
              </SectionCard>

              <Link
                href={`/institution/training/messages?applicationId=${encodeURIComponent(applicationId)}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
                {isAr ? "فتح المحادثة" : "Open conversation"}
              </Link>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
};

export default InstitutionApplicationDetailPage;
