"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { StudentFeedbackSummary } from "@/lib/partnerships/institution-student-feedback-service";

type Props = {
  applicationId: string;
  initialFeedback: StudentFeedbackSummary | null;
  isAr: boolean;
  onSaved: (feedback: StudentFeedbackSummary) => void;
};

const RATING_FIELDS = [
  { key: "overallRating", labelAr: "التقييم العام", labelEn: "Overall rating" },
  { key: "trainingQualityRating", labelAr: "جودة التدريب", labelEn: "Training quality" },
  { key: "supervisionRating", labelAr: "الإشراف", labelEn: "Supervision" },
  { key: "workEnvironmentRating", labelAr: "بيئة العمل", labelEn: "Work environment" },
  { key: "benefitRating", labelAr: "الاستفادة", labelEn: "Benefit" },
] as const;

type RatingKey = (typeof RATING_FIELDS)[number]["key"];

const InstitutionStudentFeedbackForm = ({ applicationId, initialFeedback, isAr, onSaved }: Props) => {
  const [overallRating, setOverallRating] = useState(initialFeedback?.overallRating || 0);
  const [trainingQualityRating, setTrainingQualityRating] = useState(
    initialFeedback?.trainingQualityRating || 0
  );
  const [supervisionRating, setSupervisionRating] = useState(initialFeedback?.supervisionRating || 0);
  const [workEnvironmentRating, setWorkEnvironmentRating] = useState(
    initialFeedback?.workEnvironmentRating || 0
  );
  const [benefitRating, setBenefitRating] = useState(initialFeedback?.benefitRating || 0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(
    initialFeedback ? initialFeedback.wouldRecommend : null
  );
  const [studentFeedbackNotes, setStudentFeedbackNotes] = useState(
    initialFeedback?.studentFeedbackNotes || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const ratingState: Record<RatingKey, { value: number; setter: (v: number) => void }> = {
    overallRating: { value: overallRating, setter: setOverallRating },
    trainingQualityRating: { value: trainingQualityRating, setter: setTrainingQualityRating },
    supervisionRating: { value: supervisionRating, setter: setSupervisionRating },
    workEnvironmentRating: { value: workEnvironmentRating, setter: setWorkEnvironmentRating },
    benefitRating: { value: benefitRating, setter: setBenefitRating },
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    const ratings = [
      overallRating,
      trainingQualityRating,
      supervisionRating,
      workEnvironmentRating,
      benefitRating,
    ];
    if (ratings.some((r) => r < 1 || r > 5)) {
      setError(isAr ? "يرجى اختيار تقييم من 1 إلى 5 لكل بند." : "Please rate each item from 1 to 5.");
      return;
    }
    if (wouldRecommend === null) {
      setError(isAr ? "يرجى الإجابة: هل توصي بهذه المؤسسة؟" : "Please answer whether you recommend this organization.");
      return;
    }

    setSaving(true);
    try {
      const method = initialFeedback ? "PATCH" : "POST";
      const res = await fetch(`/api/partnerships/applications/${applicationId}/student-feedback`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallRating,
          trainingQualityRating,
          supervisionRating,
          workEnvironmentRating,
          benefitRating,
          wouldRecommend,
          studentFeedbackNotes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed");
      }
      onSaved(json.feedback);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-light">
        {initialFeedback
          ? isAr
            ? "يمكنك تعديل تقييمك للمؤسسة."
            : "You can update your institution rating."
          : isAr
            ? "شاركنا تجربتك مع المؤسسة بعد انتهاء التدريب."
            : "Share your experience with the organization after completing training."}
      </p>

      {RATING_FIELDS.map((field) => (
        <div key={field.key}>
          <p className="mb-2 text-sm font-semibold">{isAr ? field.labelAr : field.labelEn}</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => ratingState[field.key].setter(n)}
                className={`h-10 w-10 rounded-xl border text-sm font-bold transition ${
                  ratingState[field.key].value === n
                    ? "border-primary bg-primary text-white"
                    : "border-border hover:border-primary/50"
                }`}
                aria-label={`${isAr ? field.labelAr : field.labelEn} ${n}`}
                aria-pressed={ratingState[field.key].value === n}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-2 text-sm font-semibold">
          {isAr ? "هل توصي بهذه المؤسسة؟" : "Would you recommend this organization?"}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setWouldRecommend(true)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              wouldRecommend === true ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
            aria-pressed={wouldRecommend === true}
          >
            {isAr ? "نعم" : "Yes"}
          </button>
          <button
            type="button"
            onClick={() => setWouldRecommend(false)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              wouldRecommend === false ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
            aria-pressed={wouldRecommend === false}
          >
            {isAr ? "لا" : "No"}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="student-feedback-notes" className="mb-2 block text-sm font-semibold">
          {isAr ? "ملاحظات الطالب" : "Your notes"}
        </label>
        <textarea
          id="student-feedback-notes"
          value={studentFeedbackNotes}
          onChange={(e) => setStudentFeedbackNotes(e.target.value)}
          className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm"
          placeholder={isAr ? "اختياري…" : "Optional…"}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? (
        <p className="text-sm text-green-700">
          {isAr ? "تم حفظ التقييم بنجاح." : "Feedback saved successfully."}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {initialFeedback ? (isAr ? "تحديث التقييم" : "Update feedback") : isAr ? "إرسال التقييم" : "Submit feedback"}
      </button>
    </div>
  );
};

export default InstitutionStudentFeedbackForm;
