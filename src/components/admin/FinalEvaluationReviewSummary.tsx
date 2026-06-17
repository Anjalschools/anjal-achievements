"use client";

import {
  computeInstitutionAssessmentAverage,
  computeStudentExperienceAverage,
  collapseInstitutionAssessmentScores,
} from "@/lib/partnerships/training-final-evaluation-ui-constants";
import { AlertTriangle, Bot, CheckCircle2, GraduationCap, Building2, XCircle } from "lucide-react";

type ReviewIndicator = "green" | "yellow" | "red";

type FinalEvaluationReviewSummaryProps = {
  application: Record<string, unknown>;
  studentEvaluation?: Record<string, unknown> | null;
  institutionEvaluation?: Record<string, unknown> | null;
  isAr: boolean;
};

const indicatorStyles: Record<ReviewIndicator, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  yellow: "border-amber-200 bg-amber-50 text-amber-950",
  red: "border-red-200 bg-red-50 text-red-900",
};

const indicatorIcon = (level: ReviewIndicator) => {
  if (level === "green") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (level === "yellow") return <AlertTriangle className="h-4 w-4" aria-hidden />;
  return <XCircle className="h-4 w-4" aria-hidden />;
};

const scoreIndicator = (score: number, max: number): ReviewIndicator => {
  const pct = score / max;
  if (pct >= 0.75) return "green";
  if (pct >= 0.5) return "yellow";
  return "red";
};

const FinalEvaluationReviewSummary = ({
  application,
  studentEvaluation,
  institutionEvaluation,
  isAr,
}: FinalEvaluationReviewSummaryProps) => {
  const studentAvg = studentEvaluation
    ? computeStudentExperienceAverage({
        practicalBenefitScore: Number(studentEvaluation.practicalBenefitScore || 0),
        objectivesClarityScore: Number(studentEvaluation.objectivesClarityScore || 0),
        supervisionQualityScore: Number(studentEvaluation.supervisionQualityScore || 0),
        workEnvironmentScore: Number(studentEvaluation.workEnvironmentScore || 0),
        relevanceScore: Number(studentEvaluation.relevanceScore || 0),
      })
    : 0;

  const institutionAvg = institutionEvaluation
    ? computeInstitutionAssessmentAverage(collapseInstitutionAssessmentScores(institutionEvaluation))
    : 0;

  const aiVerification = institutionEvaluation?.aiVerification as Record<string, unknown> | undefined;
  const aiScore = Number(aiVerification?.verificationScore || 0);
  const aiClass = String(aiVerification?.classification || "");

  const status = String(application.status || "");
  const bothSubmitted = Boolean(studentEvaluation && institutionEvaluation);
  const completionLevel: ReviewIndicator = bothSubmitted ? "green" : studentEvaluation || institutionEvaluation ? "yellow" : "red";

  const passedTraining = institutionEvaluation?.passedTraining === true;
  const recommendEmployment = institutionEvaluation?.recommendEmployment === true;
  const outcomePrediction = recommendEmployment
    ? isAr ? "توصية توظيف قوية" : "Strong employment recommendation"
    : passedTraining
      ? isAr ? "اجتياز متوقع" : "Likely pass"
      : isAr ? "يحتاج مراجعة" : "Needs review";

  const outcomeLevel: ReviewIndicator = recommendEmployment ? "green" : passedTraining ? "yellow" : "red";

  const cards = [
    {
      key: "student",
      icon: GraduationCap,
      label: isAr ? "تقييم الطالب" : "Student score",
      value: studentEvaluation ? `${studentAvg}/5` : "—",
      level: studentEvaluation ? scoreIndicator(studentAvg, 5) : ("red" as ReviewIndicator),
    },
    {
      key: "institution",
      icon: Building2,
      label: isAr ? "تقييم المؤسسة" : "Institution score",
      value: institutionEvaluation ? `${institutionAvg}/5` : "—",
      level: institutionEvaluation ? scoreIndicator(institutionAvg, 5) : ("red" as ReviewIndicator),
    },
    {
      key: "ai",
      icon: Bot,
      label: isAr ? "التحقق الآلي" : "AI verification",
      value: aiVerification ? `${aiScore}%` : "—",
      level: aiVerification ? scoreIndicator(aiScore, 100) : ("yellow" as ReviewIndicator),
      detail: aiClass || undefined,
    },
    {
      key: "completion",
      icon: CheckCircle2,
      label: isAr ? "اكتمال التقييم" : "Completion",
      value: bothSubmitted ? (isAr ? "مكتمل" : "Complete") : (isAr ? "غير مكتمل" : "Incomplete"),
      level: completionLevel,
    },
    {
      key: "outcome",
      icon: AlertTriangle,
      label: isAr ? "توقع النتيجة" : "Outcome prediction",
      value: outcomePrediction,
      level: outcomeLevel,
    },
  ];

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-foreground">
          {isAr ? "ملخص المراجعة الموحد" : "Unified review summary"}
        </h2>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-text-light">
          {status}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`flex items-start gap-2 rounded-xl border-2 px-3 py-3 ${indicatorStyles[card.level]}`}
            >
              <div className="mt-0.5 shrink-0">{indicatorIcon(card.level)}</div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-xs font-bold opacity-80">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {card.label}
                </p>
                <p className="mt-0.5 text-sm font-black">{card.value}</p>
                {card.detail ? <p className="text-[10px] font-semibold opacity-70">{card.detail}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FinalEvaluationReviewSummary;
