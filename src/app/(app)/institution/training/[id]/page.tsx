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
import type { InstitutionContactAccessView } from "@/components/institution/InstitutionContactAccessCard";
import TrainingApplicationTimeline from "@/components/partnerships/TrainingApplicationTimeline";
import TrainingApplicationStatusBadge from "@/components/partnerships/TrainingApplicationStatusBadge";
import { getLocale } from "@/lib/i18n";
import type { InstitutionStudentProfileSummary } from "@/lib/partnerships/institution-student-profile-service";
import type { CandidateScorecard } from "@/lib/partnerships/institution-candidate-pipeline-service";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";

type ApplicationDetail = {
  id: string;
  status: string;
  opportunityTitle: string;
  submittedAt: string | null;
  rejectionReason?: string;
  timeline: Array<{ at: string | null; action: string; note: string; actorName: string }>;
  studentProfile: InstitutionStudentProfileSummary;
  scorecard: CandidateScorecard | null;
  documentTracker: Array<{ id: string; titleAr: string; titleEn: string; status: string }>;
  tags: Array<{ id: string; tag: string }>;
  privateNotes: Array<{ id: string; category: string; body: string; createdAt: string | null }>;
  requirements: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
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
  const [evaluationForm, setEvaluationForm] = useState({
    commitment: 4,
    attendance: 4,
    discipline: 4,
    communication: 4,
    teamwork: 4,
    technicalSkills: 4,
    professionalSkills: 4,
    strengths: "",
    improvementAreas: "",
    institutionNotes: "",
    finalRecommendation: "good",
  });

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

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <InstitutionStudentProfileCard profile={detail.studentProfile} isAr={isAr} />

              <InstitutionCandidateScorecard scorecard={detail.scorecard} isAr={isAr} />

              <SectionCard>
                <h3 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "لوحة قرار المؤسسة" : "Institution decision workspace"}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {detail.status === "institution_review" ? (
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
                    disabled={saving || !reqTitle.trim()}
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
                    disabled={saving || !assessmentTitle.trim()}
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

              <SectionCard>
                <h3 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "متابعة المستندات" : "Document tracker"}
                </h3>
                <InstitutionDocumentTracker documents={detail.documentTracker} isAr={isAr} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={reqTitle}
                    onChange={(e) => setReqTitle(e.target.value)}
                    placeholder={isAr ? "عنوان مستند إضافي" : "Additional document title"}
                    className="min-w-[200px] flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={saving || !reqTitle.trim()}
                    onClick={() => void postAction({ action: "create_requirement", title: reqTitle.trim() }).then(() => setReqTitle(""))}
                    className="rounded-xl border border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary disabled:opacity-60"
                  >
                    {isAr ? "طلب مستند" : "Request document"}
                  </button>
                </div>
              </SectionCard>

              <SectionCard>
                <h3 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "مساحة المقابلة" : "Interview workspace"}
                </h3>
                <div className="mb-3 flex flex-wrap gap-2">
                  <input
                    type="datetime-local"
                    value={interviewAt}
                    onChange={(e) => setInterviewAt(e.target.value)}
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={saving || !interviewAt}
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
              </SectionCard>

              <SectionCard>
                <h3 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "وسوم المرشح" : "Candidate tags"}
                </h3>
                <InstitutionCandidateTagsPanel
                  applicationId={applicationId}
                  tags={detail.tags}
                  isAr={isAr}
                  onUpdated={load}
                />
              </SectionCard>

              <SectionCard>
                <h3 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "ملاحظات خاصة" : "Private notes"}
                </h3>
                <InstitutionPrivateNotesPanel
                  applicationId={applicationId}
                  notes={detail.privateNotes}
                  isAr={isAr}
                  onUpdated={load}
                />
              </SectionCard>

              <SectionCard>
                <h3 className="mb-3 text-base font-bold text-foreground">
                  {isAr ? "التقييمات" : "Assessments"}
                </h3>
                <div className="mb-3 flex flex-wrap gap-2">
                  <input
                    value={assessmentTitle}
                    onChange={(e) => setAssessmentTitle(e.target.value)}
                    placeholder={isAr ? "عنوان التقييم" : "Assessment title"}
                    className="min-w-[200px] flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={saving || !assessmentTitle.trim()}
                    onClick={() =>
                      void postAction({
                        action: "create_assessment",
                        type: "upload_task",
                        title: assessmentTitle.trim(),
                      }).then(() => setAssessmentTitle(""))
                    }
                    className="rounded-xl border border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary disabled:opacity-60"
                  >
                    {isAr ? "إنشاء" : "Create"}
                  </button>
                </div>
                <ul className="space-y-2 text-sm">
                  {detail.assessments.map((row) => (
                    <li key={row.id} className="rounded-lg border border-border/60 px-3 py-2">
                      {row.title} — <span className="text-text-light">{row.status}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              {detail.status === "accepted" && !detail.evaluation ? (
                <SectionCard>
                  <h3 className="mb-3 text-base font-bold text-foreground">
                    {isAr ? "التقرير النهائي للمؤسسة" : "Institution final training report"}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["commitment", isAr ? "الالتزام" : "Commitment"],
                        ["attendance", isAr ? "الحضور" : "Attendance"],
                        ["discipline", isAr ? "الانضباط" : "Discipline"],
                        ["communication", isAr ? "التواصل" : "Communication"],
                        ["teamwork", isAr ? "العمل الجماعي" : "Teamwork"],
                        ["technicalSkills", isAr ? "المهارات التقنية" : "Technical skills"],
                        ["professionalSkills", isAr ? "المهارات المهنية" : "Professional skills"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="text-xs font-semibold text-text-light">
                        {label}
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={evaluationForm[key]}
                          onChange={(e) =>
                            setEvaluationForm((prev) => ({ ...prev, [key]: Number(e.target.value) || 1 }))
                          }
                          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={evaluationForm.strengths}
                    onChange={(e) => setEvaluationForm((prev) => ({ ...prev, strengths: e.target.value }))}
                    placeholder={isAr ? "نقاط القوة" : "Strengths"}
                    className="mt-3 min-h-20 w-full rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <textarea
                    value={evaluationForm.improvementAreas}
                    onChange={(e) => setEvaluationForm((prev) => ({ ...prev, improvementAreas: e.target.value }))}
                    placeholder={isAr ? "فرص التحسين" : "Improvement areas"}
                    className="mt-3 min-h-20 w-full rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <select
                    value={evaluationForm.finalRecommendation}
                    onChange={(e) => setEvaluationForm((prev) => ({ ...prev, finalRecommendation: e.target.value }))}
                    className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <option value="excellent">{isAr ? "ممتاز" : "Excellent"}</option>
                    <option value="very_good">{isAr ? "جيد جداً" : "Very good"}</option>
                    <option value="good">{isAr ? "جيد" : "Good"}</option>
                    <option value="acceptable">{isAr ? "مقبول" : "Acceptable"}</option>
                    <option value="not_recommended">{isAr ? "غير موصى به" : "Not recommended"}</option>
                  </select>
                  <textarea
                    value={evaluationForm.institutionNotes}
                    onChange={(e) => setEvaluationForm((prev) => ({ ...prev, institutionNotes: e.target.value }))}
                    placeholder={isAr ? "ملاحظات المؤسسة" : "Institution notes"}
                    className="mt-3 min-h-20 w-full rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void postAction({ action: "submit_evaluation", ...evaluationForm })}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 disabled:opacity-60"
                  >
                    <ClipboardList className="h-4 w-4" aria-hidden />
                    {isAr ? "إرسال التقرير للمدرسة" : "Submit report to school"}
                  </button>
                </SectionCard>
              ) : null}
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
