"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import FinalEvaluationReviewSummary from "@/components/admin/FinalEvaluationReviewSummary";
import { getLocale } from "@/lib/i18n";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";

const AdminFinalEvaluationDetailPage = () => {
  const params = useParams();
  const applicationId = String(params?.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partnerships/final-evaluations/${encodeURIComponent(applicationId)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setDetail(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (action: "approve" | "reject" | "request_resubmission") => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partnerships/final-evaluations/${encodeURIComponent(applicationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setDetail(json);
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const application = detail?.application as Record<string, unknown> | undefined;
  const studentEval = detail?.studentEvaluation as Record<string, unknown> | undefined;
  const institutionEval = detail?.institutionEvaluation as Record<string, unknown> | undefined;
  const aiVerification = institutionEval?.aiVerification as Record<string, unknown> | undefined;

  return (
    <PageContainer>
      <Link href="/admin/partnerships/final-evaluations" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {isAr ? "العودة للقائمة" : "Back to list"}
      </Link>

      <PageHeader
        title={isAr ? "مراجعة التقييم النهائي" : "Final evaluation review"}
        subtitle={String(application?.studentName || "")}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <SectionCard><p className="py-8 text-center text-red-600">{error}</p></SectionCard>
      ) : (
        <div className="space-y-4">
          {application ? (
            <FinalEvaluationReviewSummary
              application={application}
              studentEvaluation={studentEval}
              institutionEvaluation={institutionEval}
              isAr={isAr}
            />
          ) : null}

          {studentEval ? (
            <SectionCard>
              <h2 className="mb-2 font-bold">{isAr ? "تقييم الطالب" : "Student evaluation"}</h2>
              <p className="text-sm">{isAr ? "الرضا:" : "Satisfaction:"} {String(studentEval.overallSatisfactionScore)}</p>
            </SectionCard>
          ) : null}

          {institutionEval ? (
            <SectionCard>
              <h2 className="mb-2 font-bold">{isAr ? "تقييم المؤسسة" : "Institution evaluation"}</h2>
              <p className="text-sm">{isAr ? "المشرف:" : "Supervisor:"} {String(institutionEval.supervisorName)}</p>
              {aiVerification ? (
                <p className="mt-2 text-sm text-text-light">
                  {isAr ? "التحقق الآلي:" : "AI:"} {String(aiVerification.verificationScore)}% — {String(aiVerification.classification)}
                </p>
              ) : null}
            </SectionCard>
          ) : null}

          <SectionCard>
            <h2 className="mb-3 font-bold">{isAr ? "إجراء المشرف" : "Supervisor action"}</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}
              className="mb-4 w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void handleAction("approve")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {isAr ? "اعتماد" : "Approve"}
              </button>
              <button type="button" disabled={saving} onClick={() => void handleAction("reject")} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                <XCircle className="h-4 w-4" aria-hidden />
                {isAr ? "رفض" : "Reject"}
              </button>
              <button type="button" disabled={saving} onClick={() => void handleAction("request_resubmission")} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-60">
                <RotateCcw className="h-4 w-4" aria-hidden />
                {isAr ? "طلب إعادة التقديم" : "Request resubmission"}
              </button>
            </div>
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default AdminFinalEvaluationDetailPage;
