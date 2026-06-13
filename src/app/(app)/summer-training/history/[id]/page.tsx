"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import InstitutionStudentFeedbackForm from "@/components/partnerships/InstitutionStudentFeedbackForm";
import { getLocale } from "@/lib/i18n";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { StudentFeedbackSummary } from "@/lib/partnerships/institution-student-feedback-service";

type ApplicationItem = {
  id: string;
  status: string;
  organizationName?: string;
  opportunityTitle?: string;
};

const StudentTrainingHistoryPage = () => {
  const params = useParams();
  const id = String(params.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<ApplicationItem | null>(null);
  const [feedback, setFeedback] = useState<StudentFeedbackSummary | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [appRes, feedbackRes] = await Promise.all([
        fetch(`/api/partnerships/applications/${id}`, { cache: "no-store" }),
        fetch(`/api/partnerships/applications/${id}/student-feedback`, { cache: "no-store" }),
      ]);
      const appJson = await appRes.json().catch(() => ({}));
      const feedbackJson = await feedbackRes.json().catch(() => ({}));
      if (!appRes.ok) {
        throw new Error(typeof appJson.error === "string" ? appJson.error : "Failed");
      }
      setApplication(appJson.item || null);
      setFeedback(feedbackJson.feedback || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isCompleted = application?.status === "completed";

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href={`/summer-training/${id}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isAr ? "العودة لتفاصيل التدريب" : "Back to training details"}
        </Link>
      </div>

      <PageHeader
        title={isAr ? "تقييم المؤسسة" : "Institution feedback"}
        subtitle={
          application
            ? [application.organizationName, application.opportunityTitle].filter(Boolean).join(" · ")
            : isAr
              ? "تحميل…"
              : "Loading…"
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : !application ? (
        <p className="text-text-light">{isAr ? "الطلب غير موجود." : "Application not found."}</p>
      ) : !isCompleted ? (
        <SectionCard>
          <p className="text-sm text-text-light">
            {isAr
              ? "يظهر نموذج التقييم فقط بعد إكمال التدريب."
              : "The feedback form is available only after training is completed."}
          </p>
        </SectionCard>
      ) : (
        <SectionCard>
          <InstitutionStudentFeedbackForm
            applicationId={id}
            initialFeedback={feedback}
            isAr={isAr}
            onSaved={(saved) => setFeedback(saved)}
          />
        </SectionCard>
      )}
    </PageContainer>
  );
};

export default StudentTrainingHistoryPage;
