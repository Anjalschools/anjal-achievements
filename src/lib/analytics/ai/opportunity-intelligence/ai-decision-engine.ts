/**
 * Academic Opportunity Intelligence — orchestrates eligibility, readiness, matching, pathways.
 */

import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import { buildStudentAcademicContext } from "@/lib/analytics/ai/opportunity-intelligence/eligibility-engine";
import {
  inferAchievementSignalsFromActivities,
} from "@/lib/analytics/ai/opportunity-intelligence/ai-readiness-engine";
import { matchStudentToAllCompetitions } from "@/lib/analytics/ai/opportunity-intelligence/opportunity-matching-engine";
import {
  deriveStrengthsWeaknesses,
  predictStudentPathways,
} from "@/lib/analytics/ai/opportunity-intelligence/ai-student-path-predictor";
import { sortOpportunitiesByPriority } from "@/lib/analytics/ai/opportunity-intelligence/ai-opportunity-priority";
import type {
  CompetitionOpportunityVerdict,
  StudentOpportunityProfile,
} from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";

const clamp = (n: number) => Math.min(100, Math.max(0, n));

const partitionVerdicts = (verdicts: CompetitionOpportunityVerdict[]) => ({
  eligibleCompetitions: verdicts.filter((v) => v.decision === "ELIGIBLE"),
  recommendedCompetitions: verdicts.filter(
    (v) => v.decision === "RECOMMENDED" || v.decision === "HIGH_POTENTIAL"
  ),
  blockedCompetitions: verdicts.filter((v) => v.decision === "BLOCKED"),
  futureOpportunities: verdicts.filter((v) => v.decision === "FUTURE_OPPORTUNITY"),
  notRecommended: verdicts.filter((v) => v.decision === "NOT_RECOMMENDED"),
});

const aggregateScores = (
  verdicts: CompetitionOpportunityVerdict[],
  student: ReturnType<typeof buildStudentAcademicContext>
) => {
  const active = verdicts.filter((v) => v.decision !== "BLOCKED");
  const readinessScore =
    active.length > 0
      ? Math.round(active.reduce((s, v) => s + v.readinessScore, 0) / active.length)
      : 0;
  const academicOpportunityScore =
    active.length > 0
      ? Math.round(active.reduce((s, v) => s + v.matchScore, 0) / active.length)
      : 0;
  const futurePotentialScore = clamp(
    futureOnlyScore(verdicts) * 0.4 + student.achievementHistory.continuityYears * 12
  );
  const olympiadPotentialScore = clamp(
    student.achievementHistory.scienceStrength * 0.35 +
      student.achievementHistory.mathStrength * 0.35 +
      (verdicts.some((v) => v.competitionKey === "nasmo" && v.decision !== "BLOCKED") ? 25 : 0)
  );
  return { readinessScore, academicOpportunityScore, futurePotentialScore, olympiadPotentialScore };
};

const futureOnlyScore = (verdicts: CompetitionOpportunityVerdict[]): number => {
  const f = verdicts.filter((v) => v.decision === "FUTURE_OPPORTUNITY");
  if (f.length === 0) return 0;
  return Math.round(f.reduce((s, v) => s + v.matchScore, 0) / f.length);
};

export const buildStudentOpportunityProfile = (
  student: ReturnType<typeof buildStudentAcademicContext>
): StudentOpportunityProfile => {
  const verdicts = sortOpportunitiesByPriority(matchStudentToAllCompetitions(student));
  const parts = partitionVerdicts(verdicts);
  const scores = aggregateScores(verdicts, student);
  const { strengths, weaknesses } = deriveStrengthsWeaknesses(student, verdicts);
  const pathwayRecommendations = predictStudentPathways(student, verdicts);

  return {
    participantId: student.participantId,
    generatedAt: new Date().toISOString(),
    ...parts,
    ...scores,
    strengths,
    weaknesses,
    pathwayRecommendations,
  };
};

export const buildStudentOpportunityProfileFromIntelRow = (
  row: StudentIntelRow,
  opts?: {
    grade?: string;
    activityKeys?: string[];
    studyAbroadIntent?: boolean;
  }
): StudentOpportunityProfile => {
  const signals = inferAchievementSignalsFromActivities(opts?.activityKeys ?? [], {
    participationCount: row.recordCount,
    medalCount: row.medalCount,
    continuityYears: row.yearSpan ?? (row.growthIndex ? 2 : 1),
  });

  const student = buildStudentAcademicContext({
    participantId: row.participantId,
    grade: opts?.grade,
    section: row.sectionKey,
    stageKey: row.stageKey,
    mawhiba: row.mawhiba,
    studyAbroadIntent: opts?.studyAbroadIntent,
    signals,
  });

  return buildStudentOpportunityProfile(student);
};

export const buildCohortOpportunityProfiles = (
  rows: StudentIntelRow[],
  opts?: { maxProfiles?: number; activityKeysByStudent?: Record<string, string[]> }
): StudentOpportunityProfile[] => {
  const max = opts?.maxProfiles ?? 50;
  return rows.slice(0, max).map((row) =>
    buildStudentOpportunityProfileFromIntelRow(row, {
      activityKeys: opts?.activityKeysByStudent?.[row.participantId],
    })
  );
};

export type OpportunityIntelligenceBundle = {
  profiles: StudentOpportunityProfile[];
  aggregate: {
    topRecommendedKeys: string[];
    commonBlockedKeys: string[];
    avgReadiness: number;
  };
};

export const buildOpportunityIntelligenceBundle = (
  rows: StudentIntelRow[],
  opts?: { maxProfiles?: number }
): OpportunityIntelligenceBundle => {
  const profiles = buildCohortOpportunityProfiles(rows, opts);
  const recCount = new Map<string, number>();
  const blockCount = new Map<string, number>();
  let readinessSum = 0;

  for (const p of profiles) {
    readinessSum += p.readinessScore;
    for (const r of p.recommendedCompetitions) {
      recCount.set(r.competitionKey, (recCount.get(r.competitionKey) ?? 0) + 1);
    }
    for (const b of p.blockedCompetitions) {
      blockCount.set(b.competitionKey, (blockCount.get(b.competitionKey) ?? 0) + 1);
    }
  }

  const topRecommendedKeys = [...recCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  const commonBlockedKeys = [...blockCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  return {
    profiles,
    aggregate: {
      topRecommendedKeys,
      commonBlockedKeys,
      avgReadiness: profiles.length ? Math.round(readinessSum / profiles.length) : 0,
    },
  };
};
