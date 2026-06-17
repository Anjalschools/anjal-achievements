"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import SurveyRatingControl from "@/components/survey/SurveyRatingControl";
import SurveyExperienceCard from "@/components/survey/SurveyExperienceCard";
import SurveySatisfactionControl from "@/components/survey/SurveySatisfactionControl";
import TrainingEvidenceGallery, {
  type TrainingEvidenceImage,
} from "@/components/partnerships/TrainingEvidenceGallery";
import FinalEvaluationWorkflowGuide from "@/components/partnerships/FinalEvaluationWorkflowGuide";
import { getLocale } from "@/lib/i18n";
import { ArrowLeft, Building2, CalendarDays, Clock, Eye, Loader2, Save } from "lucide-react";

type EvalContext = {
  institutionName: string;
  opportunityTitle: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  applicationStatus: string;
};

const StudentFinalEvaluationPage = () => {
  const params = useParams();
  const opportunityId = String(params?.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [locked, setLocked] = useState(false);
  const [context, setContext] = useState<EvalContext | null>(null);
  const [images, setImages] = useState<TrainingEvidenceImage[]>([]);
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

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString(isAr ? "ar-SA" : "en-US");
    } catch {
      return value;
    }
  };

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

      if (evalJson.context) setContext(evalJson.context as EvalContext);

      if (evalJson.evaluation) {
        const e = evalJson.evaluation;
        setLocked(Boolean(e.locked));
        setImages(Array.isArray(e.imageAttachments) ? e.imageAttachments : []);
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

  const handlePreviewReport = async () => {
    if (!applicationId) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/partnerships/applications/${encodeURIComponent(applicationId)}/final-evaluation/student/preview-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            allowanceAmount: form.allowanceAmount ? Number(form.allowanceAmount) : undefined,
            trainingHours: form.trainingHours ? Number(form.trainingHours) : undefined,
            traineeCount: form.traineeCount ? Number(form.traineeCount) : undefined,
            videoUrls: form.videoUrls.filter((u) => u.trim()),
            imageAttachments: images,
          }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json.error === "string" ? json.error : "Preview failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setPreviewing(false);
    }
  };

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
            imageAttachments: images,
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
        title={isAr ? "تقييم الطالب النهائي" : "Student final evaluation"}
        subtitle={
          isAr
            ? "هذا النموذج للطالب فقط — لا يتضمن تقييم المؤسسة."
            : "Student-only form — institution assessment is completed separately."
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : error ? (
        <SectionCard><p className="py-8 text-center text-red-600">{error}</p></SectionCard>
      ) : (
        <div className="space-y-4">
          <FinalEvaluationWorkflowGuide isAr={isAr} audience="student" />

          {locked ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {isAr ? "تم إرسال التقييم وهو مقفل للتعديل." : "Evaluation submitted and locked for editing."}
            </div>
          ) : null}

          <SectionCard>
            <h2 className="mb-3 text-base font-bold">{isAr ? "١ — بيانات التدريب" : "1 — Training details"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <Building2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <div>
                  <p className="text-xs text-text-light">{isAr ? "المؤسسة" : "Institution"}</p>
                  <p className="font-semibold">{context?.institutionName || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <CalendarDays className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <div>
                  <p className="text-xs text-text-light">{isAr ? "الفرصة" : "Opportunity"}</p>
                  <p className="font-semibold">{context?.opportunityTitle || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <CalendarDays className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <div>
                  <p className="text-xs text-text-light">{isAr ? "فترة التدريب" : "Training period"}</p>
                  <p className="font-semibold">
                    {formatDate(context?.trainingStartDate || null)} — {formatDate(context?.trainingEndDate || null)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <Clock className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <div className="w-full">
                  <p className="text-xs text-text-light">{isAr ? "ساعات التدريب" : "Training hours"}</p>
                  <input
                    type="number"
                    min={0}
                    disabled={locked}
                    value={form.trainingHours}
                    onChange={(e) => setForm((prev) => ({ ...prev, trainingHours: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-sm"
                    aria-label={isAr ? "ساعات التدريب" : "Training hours"}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "٢ — تقييمي للتجربة التدريبية" : "2 — My training experience rating"}</h2>
            <div className="space-y-6">
              <SurveyExperienceCard
                label={isAr ? "مدى استفادتي من التدريب" : "My benefit from training"}
                value={form.practicalBenefitScore}
                onChange={(v) => setForm((prev) => ({ ...prev, practicalBenefitScore: v }))}
                isAr={isAr}
                disabled={locked}
              />
              <SurveyRatingControl
                label={isAr ? "وضوح الأهداف" : "Objectives clarity"}
                value={form.objectivesClarityScore}
                onChange={(v) => setForm((prev) => ({ ...prev, objectivesClarityScore: v }))}
                isAr={isAr}
                labelSet="student"
                disabled={locked}
              />
              <SurveyRatingControl
                label={isAr ? "جودة الإشراف" : "Supervision quality"}
                value={form.supervisionQualityScore}
                onChange={(v) => setForm((prev) => ({ ...prev, supervisionQualityScore: v }))}
                isAr={isAr}
                labelSet="student"
                disabled={locked}
              />
              <SurveyRatingControl
                label={isAr ? "بيئة العمل" : "Work environment"}
                value={form.workEnvironmentScore}
                onChange={(v) => setForm((prev) => ({ ...prev, workEnvironmentScore: v }))}
                isAr={isAr}
                labelSet="student"
                disabled={locked}
              />
              <SurveyRatingControl
                label={isAr ? "ملاءمة التدريب" : "Training relevance"}
                value={form.relevanceScore}
                onChange={(v) => setForm((prev) => ({ ...prev, relevanceScore: v }))}
                isAr={isAr}
                labelSet="student"
                disabled={locked}
              />
              <SurveySatisfactionControl
                label={isAr ? "الرضا العام" : "Overall satisfaction"}
                value={form.overallSatisfactionScore}
                onChange={(v) => setForm((prev) => ({ ...prev, overallSatisfactionScore: v }))}
                isAr={isAr}
                disabled={locked}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.recommendToStudents}
                  disabled={locked}
                  onChange={(e) => setForm((prev) => ({ ...prev, recommendToStudents: e.target.checked }))}
                />
                {isAr ? "أوصي الطلاب بهذه الفرصة" : "I recommend this opportunity to other students"}
              </label>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "٣ — المهام والاستفادة" : "3 — Tasks & learning"}</h2>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">{isAr ? "ما المهام التي أسندت إليك؟" : "What tasks were assigned?"}</span>
                <textarea
                  value={form.majorTasksCompleted}
                  disabled={locked}
                  onChange={(e) => setForm((prev) => ({ ...prev, majorTasksCompleted: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-border px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-semibold">{isAr ? "ماذا تعلمت؟" : "What did you learn?"}</span>
                <textarea
                  value={form.skillsLearned}
                  disabled={locked}
                  onChange={(e) => setForm((prev) => ({ ...prev, skillsLearned: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-border px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-semibold">{isAr ? "أثمن تجربة" : "Most valuable experience"}</span>
                <textarea
                  value={form.mostValuableExperience}
                  disabled={locked}
                  onChange={(e) => setForm((prev) => ({ ...prev, mostValuableExperience: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-border px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-semibold">{isAr ? "اقتراحات التحسين" : "Suggestions"}</span>
                <textarea
                  value={form.improvementSuggestions}
                  disabled={locked}
                  onChange={(e) => setForm((prev) => ({ ...prev, improvementSuggestions: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-border px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-semibold">{isAr ? "عدد المتدربين" : "Number of trainees"}</span>
                <input
                  type="number"
                  min={0}
                  disabled={locked}
                  value={form.traineeCount}
                  onChange={(e) => setForm((prev) => ({ ...prev, traineeCount: e.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2"
                />
              </label>

              <div className="rounded-xl border border-border/70 p-4">
                <p className="mb-2 text-sm font-semibold">{isAr ? "هل تم صرف بدل؟" : "Was a stipend provided?"}</p>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="allowance"
                      checked={form.receivedAllowance === true}
                      disabled={locked}
                      onChange={() => setForm((prev) => ({ ...prev, receivedAllowance: true }))}
                    />
                    {isAr ? "نعم" : "Yes"}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="allowance"
                      checked={form.receivedAllowance === false}
                      disabled={locked}
                      onChange={() => setForm((prev) => ({ ...prev, receivedAllowance: false, allowanceAmount: "" }))}
                    />
                    {isAr ? "لا" : "No"}
                  </label>
                </div>
                {form.receivedAllowance ? (
                  <input
                    type="number"
                    min={0}
                    disabled={locked}
                    value={form.allowanceAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, allowanceAmount: e.target.value }))}
                    placeholder={isAr ? "مبلغ البدل" : "Stipend amount"}
                    className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm"
                  />
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "٤ — المرفقات والصور" : "4 — Attachments & images"}</h2>
            <TrainingEvidenceGallery images={images} onChange={setImages} isAr={isAr} disabled={locked} />
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold">{isAr ? "٥ — رابط الفيديو" : "5 — Video link"}</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">{isAr ? "رابط فيديو" : "Video link"}</span>
              <input
                type="url"
                disabled={locked}
                value={form.videoUrls[0] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, videoUrls: [e.target.value] }))}
                placeholder="https://"
                className="w-full rounded-xl border border-border px-3 py-2"
              />
            </label>
            <p className="mt-2 text-xs text-text-light">
              {isAr ? "يُخزَّن الرابط فقط — لا يتم رفع ملف فيديو." : "Link only — video files are not uploaded."}
            </p>
          </SectionCard>

          {!locked ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={previewing || !applicationId}
                onClick={() => void handlePreviewReport()}
                className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary disabled:opacity-60"
              >
                <Eye className="h-4 w-4" aria-hidden />
                {previewing
                  ? isAr
                    ? "جاري المعاينة…"
                    : "Generating preview…"
                  : isAr
                    ? "معاينة التقرير النهائي"
                    : "Preview final report"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden />
                {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "إرسال تقييم الطالب" : "Submit student evaluation"}
              </button>
            </div>
          ) : null}

          {applicationId ? (
            <p className="text-sm">
              <Link href={`/summer-training/${opportunityId}/final-report`} className="font-semibold text-primary hover:underline">
                {isAr ? "توليد / عرض التقرير الرسمي PDF" : "Generate / view official report PDF"}
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </PageContainer>
  );
};

export default StudentFinalEvaluationPage;
