"use client";

import type { CandidateScorecard } from "@/lib/partnerships/institution-candidate-pipeline-service";

type InstitutionCandidateScorecardProps = {
  scorecard: CandidateScorecard | null;
  isAr: boolean;
  compact?: boolean;
};

const InstitutionCandidateScorecard = ({ scorecard, isAr, compact = false }: InstitutionCandidateScorecardProps) => {
  if (!scorecard) return null;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-xs">
        <span className="font-bold text-primary">{scorecard.overallScore}</span>
        <span className="text-text-light">{isAr ? "درجة المرشح" : "Candidate score"}</span>
      </div>
    );
  }

  const rows = [
    { label: isAr ? "مؤشر الإنجاز" : "Achievement", value: scorecard.achievementIndicator },
    { label: isAr ? "الإنجازات" : "Achievements", value: scorecard.achievementCount },
    { label: isAr ? "الشهادات" : "Certificates", value: scorecard.certificateCount },
    { label: isAr ? "التطوع" : "Volunteer hrs", value: scorecard.volunteerHours },
    { label: isAr ? "الجاهزية المهنية" : "Career readiness", value: `${scorecard.careerReadiness}%` },
    { label: isAr ? "اكتمال المستندات" : "Documents", value: `${scorecard.documentCompleteness}%` },
    { label: isAr ? "المقابلة" : "Interview", value: scorecard.interviewStatus },
    { label: isAr ? "التقييمات" : "Assessments", value: `${scorecard.assessmentScore}%` },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{isAr ? "بطاقة المرشح" : "Candidate scorecard"}</h3>
        <span className="rounded-full bg-primary px-3 py-1 text-sm font-black text-white">
          {scorecard.overallScore}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-border/50 px-3 py-2 text-xs">
            <p className="text-text-light">{row.label}</p>
            <p className="font-bold text-foreground">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InstitutionCandidateScorecard;
