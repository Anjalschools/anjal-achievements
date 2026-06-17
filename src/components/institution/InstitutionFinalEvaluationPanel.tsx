"use client";

import { useCallback, useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import SurveyRatingControl from "@/components/survey/SurveyRatingControl";
import FinalEvaluationWorkflowGuide from "@/components/partnerships/FinalEvaluationWorkflowGuide";
import {
  INSTITUTION_ASSESSMENT_CATEGORIES,
  INSTITUTION_ASSESSMENT_DIMENSIONS,
  INSTITUTION_OVERALL_RECOMMENDATIONS,
  collapseInstitutionAssessmentScores,
  combineInstitutionStrengthsFields,
  expandInstitutionAssessmentPayload,
  inferOverallRecommendation,
  parseInstitutionStrengthsFields,
  type InstitutionAssessmentScoreKey,
} from "@/lib/partnerships/training-final-evaluation-ui-constants";
import { AlertTriangle, Check, Loader2, Save } from "lucide-react";

type InstitutionFinalEvaluationPanelProps = {
  applicationId: string;
  isAr: boolean;
  readOnly?: boolean;
  onSubmitted?: () => void;
};

const defaultScores = (): Record<InstitutionAssessmentScoreKey, number> => ({
  attendanceScore: 4,
  workEthicsScore: 4,
  communicationScore: 4,
  teamworkScore: 4,
  learningSpeedScore: 4,
  professionalismScore: 4,
  initiativeScore: 4,
  workQualityScore: 4,
  safetyComplianceScore: 4,
  taskExecutionScore: 4,
});

const InstitutionFinalEvaluationPanel = ({
  applicationId,
  isAr,
  readOnly = false,
  onSubmitted,
}: InstitutionFinalEvaluationPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [scores, setScores] = useState(defaultScores());
  const [overallRecommendation, setOverallRecommendation] = useState("recommended");
  const [topAchievements, setTopAchievements] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvementAreas, setImprovementAreas] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorTitle, setSupervisorTitle] = useState("");
  const [supervisorPhone, setSupervisorPhone] = useState("");
  const [assignedTasks, setAssignedTasks] = useState("");
  const [trainingHours, setTrainingHours] = useState("");
  const [requiredHours, setRequiredHours] = useState(0);
  const [maxAllowedHours, setMaxAllowedHours] = useState(0);
  const [hoursOverrideConfirmed, setHoursOverrideConfirmed] = useState(false);
  const [recommendationReason, setRecommendationReason] = useState("");

  const dimensionMap = Object.fromEntries(INSTITUTION_ASSESSMENT_DIMENSIONS.map((d) => [d.key, d])) as Record<
    InstitutionAssessmentScoreKey,
    (typeof INSTITUTION_ASSESSMENT_DIMENSIONS)[number]
  >;

  const enteredHours = trainingHours ? Number(trainingHours) : 0;
  const hoursExceedsMax = requiredHours > 0 && enteredHours > maxAllowedHours;
  const needsRecommendationReason =
    overallRecommendation === "not_recommended" || overallRecommendation === "strongly_recommended";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/institution/training/applications/${encodeURIComponent(applicationId)}/final-evaluation`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (res.status === 404) return;
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      const e = json.evaluation;
      if (json.context) {
        setRequiredHours(Number(json.context.opportunityRequiredHours || 0));
        setMaxAllowedHours(Number(json.context.opportunityMaxAllowedHours || 0));
      }
      if (!e) return;
      setScores(collapseInstitutionAssessmentScores(e));
      setOverallRecommendation(inferOverallRecommendation(e));
      const parsed = parseInstitutionStrengthsFields(String(e.strengths || ""));
      setTopAchievements(parsed.topAchievements);
      setStrengths(parsed.strengths);
      setImprovementAreas(String(e.improvementAreas || ""));
      setRecommendationReason(String(e.recommendationReason || ""));
      setSupervisorName(String(e.supervisorName || ""));
      setSupervisorTitle(String(e.supervisorTitle || ""));
      setSupervisorPhone(String(e.supervisorPhone || ""));
      setAssignedTasks(String(e.assignedTasks || ""));
      setTrainingHours(e.trainingHours != null ? String(e.trainingHours) : "");
      setLocked(Boolean(e.locked) || e.supervisorReviewStatus === "approved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (readOnly || locked) return;
    if (!supervisorName.trim()) {
      setError(isAr ? "اسم المشرف المباشر مطلوب" : "Direct supervisor name is required");
      return;
    }
    if (!assignedTasks.trim()) {
      setError(isAr ? "المهام المسندة مطلوبة" : "Assigned tasks are required");
      return;
    }
    if (!topAchievements.trim()) {
      setError(isAr ? "أبرز الإنجازات مطلوبة" : "Top achievements are required");
      return;
    }
    if (!strengths.trim()) {
      setError(isAr ? "نقاط القوة مطلوبة" : "Strengths are required");
      return;
    }
    if (!improvementAreas.trim()) {
      setError(isAr ? "فرص التحسين مطلوبة" : "Improvement areas are required");
      return;
    }
    if (needsRecommendationReason && !recommendationReason.trim()) {
      setError(isAr ? "سبب التوصية مطلوب" : "Recommendation reason is required");
      return;
    }
    if (hoursExceedsMax && !hoursOverrideConfirmed) {
      setError(
        isAr
          ? "يرجى تأكيد تجاوز الساعات المعتمدة أو تعديل العدد"
          : "Confirm hours override or adjust the entered hours"
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const expanded = expandInstitutionAssessmentPayload(scores, overallRecommendation);
      const rec = INSTITUTION_OVERALL_RECOMMENDATIONS.find((r) => r.value === overallRecommendation);
      const res = await fetch(
        `/api/institution/training/applications/${encodeURIComponent(applicationId)}/final-evaluation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evaluationMode: "portal",
            ...expanded,
            strengths: combineInstitutionStrengthsFields(topAchievements, strengths),
            improvementAreas: improvementAreas.trim() || undefined,
            supervisorName: supervisorName.trim(),
            supervisorTitle: supervisorTitle.trim() || undefined,
            supervisorPhone: supervisorPhone.trim() || undefined,
            assignedTasks: assignedTasks.trim(),
            trainingHours: trainingHours ? Number(trainingHours) : undefined,
            finalRecommendation: rec ? (isAr ? rec.ar : rec.en) : undefined,
            recommendationReason: recommendationReason.trim() || undefined,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setLocked(true);
      onSubmitted?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-text-light">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {isAr ? "جاري التحميل…" : "Loading…"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FinalEvaluationWorkflowGuide isAr={isAr} audience="institution" />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {locked ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {isAr ? "تم إرسال التقييم النهائي للمؤسسة." : "Institution final evaluation submitted."}
        </p>
      ) : null}

      <SectionCard>
        <h3 className="mb-4 text-sm font-bold">{isAr ? "بيانات المشرف والتدريب" : "Supervisor & training data"}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">{isAr ? "اسم المشرف المباشر" : "Direct supervisor name"}</span>
            <input
              value={supervisorName}
              disabled={readOnly || locked}
              onChange={(e) => setSupervisorName(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">{isAr ? "المسمى الوظيفي" : "Job title"}</span>
            <input
              value={supervisorTitle}
              disabled={readOnly || locked}
              onChange={(e) => setSupervisorTitle(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">{isAr ? "رقم التواصل" : "Contact number"}</span>
            <input
              type="tel"
              value={supervisorPhone}
              disabled={readOnly || locked}
              onChange={(e) => setSupervisorPhone(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">{isAr ? "إجمالي ساعات التدريب الفعلية" : "Actual training hours"}</span>
            <input
              type="number"
              min={0}
              value={trainingHours}
              disabled={readOnly || locked}
              onChange={(e) => {
                setTrainingHours(e.target.value);
                setHoursOverrideConfirmed(false);
              }}
              className="w-full rounded-xl border border-border px-3 py-2"
            />
            {requiredHours > 0 ? (
              <p className="mt-1 text-xs text-text-light">
                {isAr
                  ? `الساعات المعتمدة للفرصة: ${requiredHours} (مسموح حتى ${maxAllowedHours})`
                  : `Opportunity required hours: ${requiredHours} (allowed up to ${maxAllowedHours})`}
              </p>
            ) : null}
            {hoursExceedsMax ? (
              <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <p className="flex items-start gap-1.5 font-semibold">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {isAr
                    ? "عدد الساعات المدخلة أعلى من الساعات المعتمدة للفرصة التدريبية."
                    : "Entered hours exceed the approved opportunity training hours."}
                </p>
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hoursOverrideConfirmed}
                    disabled={readOnly || locked}
                    onChange={(e) => setHoursOverrideConfirmed(e.target.checked)}
                  />
                  {isAr ? "تأكيد تجاوز الساعات (بموافقة المشرف)" : "Confirm hours override (supervisor approved)"}
                </label>
              </div>
            ) : null}
          </label>
        </div>
      </SectionCard>

      {INSTITUTION_ASSESSMENT_CATEGORIES.map((category) => (
        <SectionCard key={category.id}>
          <h3 className="mb-4 text-sm font-bold">{isAr ? category.ar : category.en}</h3>
          <div className="space-y-5">
            {category.keys.map((key) => {
              const dim = dimensionMap[key];
              if (!dim) return null;
              return (
                <SurveyRatingControl
                  key={dim.key}
                  label={isAr ? dim.ar : dim.en}
                  value={scores[dim.key]}
                  onChange={(v) => setScores((prev) => ({ ...prev, [dim.key]: v }))}
                  isAr={isAr}
                  labelSet="institution"
                  disabled={readOnly || locked}
                />
              );
            })}
          </div>
        </SectionCard>
      ))}

      <SectionCard>
        <h3 className="mb-4 text-sm font-bold">{isAr ? "التقرير النهائي" : "Final report narrative"}</h3>
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">{isAr ? "المهام المسندة للطالب" : "Tasks assigned to student"}</span>
            <textarea
              value={assignedTasks}
              disabled={readOnly || locked}
              onChange={(e) => setAssignedTasks(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">{isAr ? "أبرز الإنجازات أثناء التدريب" : "Top achievements during training"}</span>
            <textarea
              value={topAchievements}
              disabled={readOnly || locked}
              onChange={(e) => setTopAchievements(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">{isAr ? "نقاط القوة" : "Strengths"}</span>
            <textarea
              value={strengths}
              disabled={readOnly || locked}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">{isAr ? "فرص التحسين" : "Improvement opportunities"}</span>
            <textarea
              value={improvementAreas}
              disabled={readOnly || locked}
              onChange={(e) => setImprovementAreas(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2"
              required
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold">{isAr ? "توصية المؤسسة" : "Institution recommendation"}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {INSTITUTION_OVERALL_RECOMMENDATIONS.map((rec) => {
                const selected = overallRecommendation === rec.value;
                return (
                  <button
                    key={rec.value}
                    type="button"
                    disabled={readOnly || locked}
                    onClick={() => setOverallRecommendation(rec.value)}
                    className={`relative rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-white text-text-light hover:border-primary/40"
                    }`}
                  >
                    {selected ? (
                      <Check className="absolute start-2 top-2 h-3.5 w-3.5 text-primary" aria-hidden />
                    ) : null}
                    {isAr ? rec.ar : rec.en}
                  </button>
                );
              })}
            </div>
          </div>

          {needsRecommendationReason ? (
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">{isAr ? "سبب التوصية" : "Recommendation reason"}</span>
              <textarea
                value={recommendationReason}
                disabled={readOnly || locked}
                onChange={(e) => setRecommendationReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border px-3 py-2"
                required
                placeholder={
                  isAr
                    ? "اشرح سبب التوصية القوية أو عدم التوصية"
                    : "Explain why you strongly recommend or do not recommend"
                }
              />
            </label>
          ) : null}
        </div>
      </SectionCard>

      {!readOnly && !locked ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSubmit()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden />
          {saving ? (isAr ? "جاري الإرسال…" : "Submitting…") : isAr ? "إرسال التقييم النهائي" : "Submit final evaluation"}
        </button>
      ) : null}
    </div>
  );
};

export default InstitutionFinalEvaluationPanel;
