"use client";

import {
  collapseInstitutionAssessmentScores,
  computeInstitutionAssessmentAverage,
  inferOverallRecommendation,
  INSTITUTION_OVERALL_RECOMMENDATIONS,
  parseInstitutionStrengthsFields,
} from "@/lib/partnerships/training-final-evaluation-ui-constants";
import { Award, Star, TrendingUp } from "lucide-react";

type StudentInstitutionEvaluationSummaryProps = {
  evaluation: Record<string, unknown>;
  isAr: boolean;
};

const StudentInstitutionEvaluationSummary = ({
  evaluation,
  isAr,
}: StudentInstitutionEvaluationSummaryProps) => {
  const scores = collapseInstitutionAssessmentScores(evaluation);
  const average = computeInstitutionAssessmentAverage(scores);
  const recommendation = inferOverallRecommendation(evaluation);
  const recRow = INSTITUTION_OVERALL_RECOMMENDATIONS.find((r) => r.value === recommendation);
  const parsed = parseInstitutionStrengthsFields(String(evaluation.strengths || ""));

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Award className="h-5 w-5 text-emerald-700" aria-hidden />
            {isAr ? "تقييم المؤسسة النهائي" : "Institution final evaluation"}
          </h2>
          <p className="mt-1 text-xs text-text-light">
            {isAr ? "يُعرض بعد اعتماد المشرف المدرسي فقط" : "Shown after school supervisor approval only"}
          </p>
        </div>
        <div className="rounded-xl bg-white px-4 py-2 text-center shadow-sm">
          <p className="text-xs font-bold text-text-light">{isAr ? "المتوسط" : "Average"}</p>
          <p className="text-2xl font-black text-emerald-700">{average}/5</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-white p-3">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold text-text-light">
            <Star className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "توصية المؤسسة" : "Recommendation"}
          </p>
          <p className="text-sm font-bold text-foreground">
            {recRow ? (isAr ? recRow.ar : recRow.en) : String(evaluation.finalRecommendation || "—")}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-3">
          <p className="mb-1 text-xs font-bold text-text-light">{isAr ? "المشرف" : "Supervisor"}</p>
          <p className="text-sm font-semibold">{String(evaluation.supervisorName || "—")}</p>
        </div>
      </div>

      {parsed.topAchievements ? (
        <div className="rounded-xl border border-border/60 bg-white p-3">
          <p className="mb-1 text-xs font-bold text-text-light">{isAr ? "أبرز الإنجازات" : "Top achievements"}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{parsed.topAchievements}</p>
        </div>
      ) : null}

      {parsed.strengths ? (
        <div className="rounded-xl border border-border/60 bg-white p-3">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold text-text-light">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            {isAr ? "نقاط القوة" : "Strengths"}
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{parsed.strengths}</p>
        </div>
      ) : null}

      {evaluation.improvementAreas ? (
        <div className="rounded-xl border border-border/60 bg-white p-3">
          <p className="mb-1 text-xs font-bold text-text-light">{isAr ? "فرص التحسين" : "Improvement opportunities"}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{String(evaluation.improvementAreas)}</p>
        </div>
      ) : null}

      {evaluation.recommendationReason ? (
        <div className="rounded-xl border border-border/60 bg-white p-3">
          <p className="mb-1 text-xs font-bold text-text-light">{isAr ? "ملاحظات المؤسسة" : "Institution comments"}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{String(evaluation.recommendationReason)}</p>
        </div>
      ) : null}
    </div>
  );
};

export default StudentInstitutionEvaluationSummary;
