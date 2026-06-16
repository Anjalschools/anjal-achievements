"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { ArrowLeft, Loader2, Save } from "lucide-react";

const scoreOptions = [1, 2, 3, 4, 5];
const satisfactionOptions = Array.from({ length: 10 }, (_, i) => i + 1);

const StudentFinalEvaluationPage = () => {
  const params = useParams();
  const opportunityId = String(params?.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [locked, setLocked] = useState(false);
  const [form, setForm] = useState({
    objectivesClarityScore: 4,
    supervisionQualityScore: 4,
    practicalBenefitScore: 4,
    relevanceScore: 4,
    workEnvironmentScore: 4,
    overallSatisfactionScore: 8,
    recommendToStudents: true,
    receivedAllowance: false,
    allowanceAmount: "",
    trainingHours: "",
    traineeCount: "",
    skillsLearned: "",
    majorTasksCompleted: "",
    mostValuableExperience: "",
    improvementSuggestions: "",
    videoUrls: [""],
  });

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
      if (!appId) throw new Error(isAr ? "لا يوجد طلب مرتبط." : "No linked application.");

      setApplicationId(appId);

      const evalRes = await fetch(
        `/api/partnerships/applications/${encodeURIComponent(appId)}/final-evaluation/student`,
        { cache: "no-store" }
      );
      const evalJson = await evalRes.json().catch(() => ({}));
      if (evalRes.status === 403) {
        throw new Error(isAr ? "التقييم غير متاح حالياً." : "Evaluation not available yet.");
      }
      if (!evalRes.ok && evalRes.status !== 404) {
        throw new Error(typeof evalJson.error === "string" ? evalJson.error : "Failed");
      }

      if (evalJson.evaluation) {
        const e = evalJson.evaluation;
        setLocked(Boolean(e.locked));
        setForm((prev) => ({
          ...prev,
          objectivesClarityScore: e.objectivesClarityScore ?? 4,
          supervisionQualityScore: e.supervisionQualityScore ?? 4,
          practicalBenefitScore: e.practicalBenefitScore ?? 4,
          relevanceScore: e.relevanceScore ?? 4,
          workEnvironmentScore: e.workEnvironmentScore ?? 4,
          overallSatisfactionScore: e.overallSatisfactionScore ?? 8,
          recommendToStudents: e.recommendToStudents ?? true,
          receivedAllowance: e.receivedAllowance ?? false,
          allowanceAmount: e.allowanceAmount != null ? String(e.allowanceAmount) : "",
          trainingHours: e.trainingHours != null ? String(e.trainingHours) : "",
          traineeCount: e.traineeCount != null ? String(e.traineeCount) : "",
          skillsLearned: e.skillsLearned || "",
          majorTasksCompleted: e.majorTasksCompleted || "",
          mostValuableExperience: e.mostValuableExperience || "",
          improvementSuggestions: e.improvementSuggestions || "",
          videoUrls: e.videoUrls?.length ? e.videoUrls : [""],
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [isAr, opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!applicationId || locked) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/partnerships/applications/${encodeURIComponent(applicationId)}/final-evaluation/student`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            allowanceAmount: form.allowanceAmount ? Number(form.allowanceAmount) : undefined,
            trainingHours: form.trainingHours ? Number(form.trainingHours) : undefined,
            traineeCount: form.traineeCount ? Number(form.traineeCount) : undefined,
            videoUrls: form.videoUrls.filter((u) => u.trim()),
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setLocked(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <Link href={`/summer-training/${opportunityId}`} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {isAr ? "العودة" : "Back"}
      </Link>

      <PageHeader
        title={isAr ? "التقييم النهائي للتدريب" : "Final training evaluation"}
        subtitle={isAr ? "قيّم تجربتك التدريبية بعد اكتمال البرنامج." : "Rate your training experience after program completion."}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : error ? (
        <SectionCard><p className="py-8 text-center text-red-600">{error}</p></SectionCard>
      ) : (
        <SectionCard>
          {locked ? (
            <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {isAr ? "تم إرسال التقييم وهو مقفل للتعديل." : "Evaluation submitted and locked for editing."}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { key: "objectivesClarityScore", label: isAr ? "وضوح الأهداف" : "Objectives clarity" },
              { key: "supervisionQualityScore", label: isAr ? "جودة الإشراف" : "Supervision quality" },
              { key: "practicalBenefitScore", label: isAr ? "الفائدة العملية" : "Practical benefit" },
              { key: "relevanceScore", label: isAr ? "الملاءمة" : "Relevance" },
              { key: "workEnvironmentScore", label: isAr ? "بيئة العمل" : "Work environment" },
            ].map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="mb-1 block font-semibold">{field.label}</span>
                <select
                  value={String(form[field.key as keyof typeof form])}
                  disabled={locked}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-border px-3 py-2"
                >
                  {scoreOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">{isAr ? "الرضا العام (1-10)" : "Overall satisfaction (1-10)"}</span>
              <select
                value={String(form.overallSatisfactionScore)}
                disabled={locked}
                onChange={(e) => setForm((prev) => ({ ...prev, overallSatisfactionScore: Number(e.target.value) }))}
                className="w-full rounded-xl border border-border px-3 py-2"
              >
                {satisfactionOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {[
              { key: "skillsLearned", label: isAr ? "المهارات المكتسبة" : "Skills learned" },
              { key: "majorTasksCompleted", label: isAr ? "أهم المهام" : "Major tasks completed" },
              { key: "mostValuableExperience", label: isAr ? "أثمن تجربة" : "Most valuable experience" },
              { key: "improvementSuggestions", label: isAr ? "اقتراحات التحسين" : "Improvement suggestions" },
            ].map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="mb-1 block font-semibold">{field.label}</span>
                <textarea
                  value={String(form[field.key as keyof typeof form])}
                  disabled={locked}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.recommendToStudents}
              disabled={locked}
              onChange={(e) => setForm((prev) => ({ ...prev, recommendToStudents: e.target.checked }))}
            />
            {isAr ? "أوصي الطلاب بهذه الفرصة" : "I recommend this opportunity to other students"}
          </label>

          {!locked ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "إرسال التقييم" : "Submit evaluation"}
            </button>
          ) : null}

          {applicationId ? (
            <p className="mt-4 text-sm">
              <Link href={`/summer-training/${opportunityId}/final-report`} className="font-semibold text-primary hover:underline">
                {isAr ? "عرض التقرير النهائي" : "View final report"}
              </Link>
            </p>
          ) : null}
        </SectionCard>
      )}
    </PageContainer>
  );
};

export default StudentFinalEvaluationPage;
