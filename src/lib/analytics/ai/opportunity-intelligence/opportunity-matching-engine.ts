/**
 * Match students to competitions — eligibility × readiness × pathway fit.
 */

import {
  COMPETITION_ELIGIBILITY_REGISTRY,
  type CompetitionEligibilityConfig,
} from "@/lib/analytics/ai/opportunity-intelligence/competition-eligibility-config";
import { evaluateEligibility } from "@/lib/analytics/ai/opportunity-intelligence/eligibility-engine";
import { computeOpportunityReadiness } from "@/lib/analytics/ai/opportunity-intelligence/ai-readiness-engine";
import type {
  CompetitionOpportunityVerdict,
  OpportunityDecisionKind,
  OpportunityDecisionFactor,
  OpportunityPriority,
  StudentAcademicContext,
} from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const classifyDecision = (
  eligibility: ReturnType<typeof evaluateEligibility>,
  readiness: number,
  matchScore: number
): OpportunityDecisionKind => {
  if (eligibility.blocked) return "BLOCKED";
  if (eligibility.futureOnly) return "FUTURE_OPPORTUNITY";
  if (!eligibility.eligible) return "BLOCKED";
  if (readiness >= 78 && matchScore >= 70) return "RECOMMENDED";
  if (readiness >= 62 && matchScore >= 55) return "HIGH_POTENTIAL";
  if (readiness >= 45) return "ELIGIBLE";
  if (readiness >= 28) return "NOT_RECOMMENDED";
  return "NOT_RECOMMENDED";
};

const priorityFrom = (
  decision: OpportunityDecisionKind,
  matchScore: number
): OpportunityPriority => {
  if (decision === "RECOMMENDED" && matchScore >= 80) return "critical";
  if (decision === "RECOMMENDED" || decision === "HIGH_POTENTIAL") return "high";
  if (decision === "FUTURE_OPPORTUNITY") return "medium";
  if (decision === "BLOCKED") return "low";
  return "medium";
};

const confidenceFrom = (
  student: StudentAcademicContext,
  eligibility: ReturnType<typeof evaluateEligibility>,
  readiness: number
): number => {
  let c = 0.72;
  if (!student.gradeInferred) c += 0.12;
  if (student.achievementHistory.participationCount >= 3) c += 0.08;
  if (eligibility.blocked || eligibility.futureOnly) c += 0.06;
  if (readiness >= 60) c += 0.04;
  return clamp01(c);
};

const buildFactors = (
  eligibility: ReturnType<typeof evaluateEligibility>,
  readiness: ReturnType<typeof computeOpportunityReadiness>,
  matchScore: number
): OpportunityDecisionFactor[] => [
  {
    key: "eligibility",
    weight: eligibility.eligible ? 1 : 0,
    labelAr: eligibility.eligible ? "أهلية مؤكدة" : "أهلية مرفوضة",
    labelEn: eligibility.eligible ? "Eligibility confirmed" : "Eligibility denied",
  },
  {
    key: "readiness",
    weight: readiness.overall / 100,
    labelAr: `جاهزية ${readiness.overall}/100`,
    labelEn: `Readiness ${readiness.overall}/100`,
  },
  {
    key: "match",
    weight: matchScore / 100,
    labelAr: `ملاءمة ${matchScore}/100`,
    labelEn: `Match ${matchScore}/100`,
  },
];

const shouldDeprioritize = (
  config: CompetitionEligibilityConfig,
  student: StudentAcademicContext,
  strongKeys: Set<string>
): boolean => {
  if (!config.deprioritizeWhenStrong?.length) return false;
  return config.deprioritizeWhenStrong.some((k) => strongKeys.has(k));
};

export const matchStudentToCompetition = (
  student: StudentAcademicContext,
  config: CompetitionEligibilityConfig,
  strongKeys: Set<string>
): CompetitionOpportunityVerdict => {
  const eligibility = evaluateEligibility(student, config);
  const readiness = computeOpportunityReadiness(student, config);

  let matchScore = Math.round(readiness.overall * 0.55 + readiness.pathwayFit * 0.45);
  if (shouldDeprioritize(config, student, strongKeys)) {
    matchScore = Math.max(0, matchScore - 35);
  }
  if (config.key === "sat" && student.section === "international") {
    matchScore = Math.min(100, matchScore + 15);
  }
  if (config.key === "sat" && student.studyAbroadIntent) {
    matchScore = Math.min(100, matchScore + 20);
  }

  const decision = classifyDecision(eligibility, readiness.overall, matchScore);
  const confidence = confidenceFrom(student, eligibility, readiness.overall);

  const timeHorizon: CompetitionOpportunityVerdict["timeHorizon"] =
    decision === "FUTURE_OPPORTUNITY" ? "next_year"
    : decision === "RECOMMENDED" || decision === "HIGH_POTENTIAL" ? "now"
    : "long_term";

  const extraAr: string[] = [];
  const extraEn: string[] = [];
  if (shouldDeprioritize(config, student, strongKeys)) {
    extraAr.push("مسار آخر أكثر ملاءمة للطالب حاليًا");
    extraEn.push("Another pathway is a stronger current fit");
  }
  if (student.gradeInferred) {
    extraAr.push("الصف مُستنتج — يُفضّل التحقق من السجل");
    extraEn.push("Grade inferred — verify student record");
  }

  return {
    competitionKey: config.key,
    titleAr: config.titleAr,
    titleEn: config.titleEn,
    decision,
    confidence,
    priority: priorityFrom(decision, matchScore),
    readinessScore: readiness.overall,
    matchScore,
    reasonsAr: [...eligibility.reasonsAr, ...extraAr],
    reasonsEn: [...eligibility.reasonsEn, ...extraEn],
    factors: buildFactors(eligibility, readiness, matchScore),
    timeHorizon,
  };
};

export const matchStudentToAllCompetitions = (
  student: StudentAcademicContext
): CompetitionOpportunityVerdict[] => {
  const preliminary = COMPETITION_ELIGIBILITY_REGISTRY.map((config) =>
    matchStudentToCompetition(student, config, new Set())
  );
  const strong = new Set(
    preliminary
      .filter((v) => v.decision === "RECOMMENDED" || v.decision === "HIGH_POTENTIAL")
      .map((v) => v.competitionKey)
  );
  return COMPETITION_ELIGIBILITY_REGISTRY.map((config) =>
    matchStudentToCompetition(student, config, strong)
  );
};
