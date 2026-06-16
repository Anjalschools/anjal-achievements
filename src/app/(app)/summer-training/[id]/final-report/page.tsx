"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { ArrowLeft, Loader2 } from "lucide-react";

const StudentFinalReportPage = () => {
  const params = useParams();
  const opportunityId = String(params?.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!opportunityId) return;
    setLoading(true);
    setError(null);
    try {
      const oppRes = await fetch(`/api/partnerships/student-opportunities?id=${encodeURIComponent(opportunityId)}`, {
        cache: "no-store",
      });
      const oppJson = await oppRes.json().catch(() => ({}));
      if (!oppRes.ok) throw new Error(typeof oppJson.error === "string" ? oppJson.error : "Failed");

      const appId =
        oppJson.item?.studentApplication?.applicationId ||
        oppJson.item?.application?.id ||
        "";
      if (!appId) throw new Error(isAr ? "لا يوجد طلب." : "No application.");

      const res = await fetch(`/api/partnerships/applications/${encodeURIComponent(appId)}/final-report`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAr, opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const studentEval = data?.studentEvaluation as Record<string, unknown> | null | undefined;
  const institutionEval = data?.institutionEvaluation as Record<string, unknown> | null | undefined;
  const aiVerification = data?.aiVerification as Record<string, unknown> | null | undefined;

  return (
    <PageContainer>
      <Link href={`/summer-training/${opportunityId}`} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {isAr ? "العودة" : "Back"}
      </Link>

      <PageHeader
        title={isAr ? "التقرير النهائي" : "Final report"}
        subtitle={isAr ? "عرض تقييمك وتقييم المؤسسة ونتيجة المراجعة." : "View your evaluation, institution evaluation, and review outcome."}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <SectionCard><p className="py-8 text-center text-red-600">{error}</p></SectionCard>
      ) : (
        <div className="space-y-4">
          <SectionCard>
            <h2 className="mb-2 text-base font-bold">{isAr ? "قرار المشرف" : "Supervisor decision"}</h2>
            <p className="text-sm text-text-light">
              {String(data?.supervisorDecision || "pending")} — {String(data?.supervisorNotes || "")}
            </p>
          </SectionCard>

          {studentEval ? (
            <SectionCard>
              <h2 className="mb-2 text-base font-bold">{isAr ? "تقييمك" : "Your evaluation"}</h2>
              <p className="text-sm">{isAr ? "الرضا العام:" : "Overall satisfaction:"} {String(studentEval.overallSatisfactionScore)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-light">{String(studentEval.skillsLearned || "")}</p>
            </SectionCard>
          ) : null}

          {institutionEval ? (
            <SectionCard>
              <h2 className="mb-2 text-base font-bold">{isAr ? "تقييم المؤسسة" : "Institution evaluation"}</h2>
              <p className="text-sm">{isAr ? "المشرف:" : "Supervisor:"} {String(institutionEval.supervisorName || "")}</p>
              <p className="text-sm">{isAr ? "اجتاز التدريب:" : "Passed:"} {institutionEval.passedTraining ? (isAr ? "نعم" : "Yes") : (isAr ? "لا" : "No")}</p>
            </SectionCard>
          ) : null}

          {aiVerification ? (
            <SectionCard>
              <h2 className="mb-2 text-base font-bold">{isAr ? "التحقق الآلي" : "AI verification"}</h2>
              <p className="text-sm">{isAr ? "الدرجة:" : "Score:"} {String(aiVerification.verificationScore)}%</p>
              <p className="text-sm">{isAr ? "التصنيف:" : "Classification:"} {String(aiVerification.classification)}</p>
              <p className="mt-2 text-sm text-text-light">{isAr ? String(aiVerification.summaryAr) : String(aiVerification.summaryEn)}</p>
            </SectionCard>
          ) : null}
        </div>
      )}
    </PageContainer>
  );
};

export default StudentFinalReportPage;
